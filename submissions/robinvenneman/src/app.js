import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import EventEmitter from 'events';

import { Dispatcher } from 'flux';

import 'whatwg-fetch';


// Constants
const DARK_JEDI_API = 'http://localhost:3000/dark-jedis/';
const PLANET_WEBSOCKET = 'ws://localhost:4000';

const LIST_SIZE = 5;

const INITIAL_DARKJEDI_ID = 3616;

const constants = {
	DARK_JEDI_LOADED: 'DARK_JEDI_LOADED',
	PLANET_CHANGED: 'PLANET_CHANGED',
	SCROLL_UP: 'SCROLL_UP',
	SCROLL_DOWN: 'SCROLL_DOWN'
};

// events
const CHANGE_EVENT = 'change';


// FLUX DISPATCHER
const appDispatcher = new Dispatcher();


// DAO for network access
const darkJediDAO = {

	getById (id) {
		return fetch(DARK_JEDI_API + id)
			.then((response) => response.json())
			.catch((err) => console.error(err));
	}

};

// ACTION CREATORS

const wsActionCreator = {

	initializeConnection () {
		const planetConnection = new WebSocket(PLANET_WEBSOCKET);
		planetConnection.onmessage = (evt) => {
			appDispatcher.dispatch({
				actionType: constants.PLANET_CHANGED,
				data: JSON.parse(evt.data)
			});
		};
	}

};

const apiActionCreator = {

	getDarkJedi (id, slot) {
		darkJediDAO.getById(id)
			.then((darkJedi) => {
				appDispatcher.dispatch({
					actionType: constants.DARK_JEDI_LOADED,
					data: { darkJedi, slot }
				});
			});
	}

};

const darkJediActionCreator = {

	scrollUp () {
		appDispatcher.dispatch({
			actionType: constants.SCROLL_UP
		});
	},

	scrollDown () {
		appDispatcher.dispatch({
			actionType: constants.SCROLL_DOWN
		});
	}

};


// DARK JEDI STORE

const _darkJedis = new Array(LIST_SIZE).fill({});
const _addDarkJedi = (dj, i) => _darkJedis[i] = dj;

const darkJediStore = Object.assign({}, EventEmitter.prototype, {

	emitChange () {
		this.emit(CHANGE_EVENT);
	},

	addChangeListener (cb) {
		this.on(CHANGE_EVENT, cb);
	},

	removeChangeListener (cb) {
		this.removeChangeListener(CHANGE_EVENT, cb)
	},

	getAll: () => _darkJedis

});

appDispatcher.register((action) => {
	const { actionType, data } = action;
	switch (actionType) {
		case constants.DARK_JEDI_LOADED:
			const { darkJedi, slot } = data;
			_addDarkJedi(darkJedi, slot);
			darkJediStore.emitChange();
			break;
		case constants.SCROLL_UP:
			_darkJedis.splice(3, 2);
			_darkJedis.unshift({}, {});
			darkJediStore.emitChange();
			break;
		case constants.SCROLL_DOWN:
			_darkJedis.splice(0, 2);
			_darkJedis.push({}, {});
			darkJediStore.emitChange();
			break;
	}
});

// PLANET STORE

let _currentPlanet = {};

const planetStore = Object.assign({}, EventEmitter.prototype, {

	emitChange () {
		this.emit(CHANGE_EVENT);
	},

	addChangeListener (cb) {
		this.on(CHANGE_EVENT, cb);
	},

	removeChangeListener (cb) {
		this.removeChangeListener(CHANGE_EVENT, cb)
	},

	get: () => _currentPlanet

});

appDispatcher.register((action) => {
	const { actionType, data } = action;
	switch (actionType) {
		case constants.PLANET_CHANGED:
			_currentPlanet = data;
			planetStore.emitChange();
			break;
	}
});

// UI COMPONENTS

const PlanetMonitor = ({ planetName }) =>
	<h1 className='css-planet-monitor'>Obi-Wan currently on {planetName}</h1>;

const DarkJediListItem = ({ id, name, homeworld, currentPlanet }) =>
	<li className='css-slot' style={ currentPlanet ? { color: 'red' } : null }>
		{ name ? <h3>{ name }</h3> : null }
		{ homeworld ? <h6>Homeworld: {homeworld.name}</h6> : null }
	</li>;

const DarkJediList = ({ darkJedis, currentPlanetId }) =>
	<ul className='css-slots'>
		{ darkJedis.map((darkJedi, i) =>
			<DarkJediListItem
				key={darkJedi.id || i}
				currentPlanet={darkJedi.homeworld && currentPlanetId === darkJedi.homeworld.id}
				{...darkJedi} />
		)}
	</ul>;

const ScrollButton = ({ name, enabled, onClick }) => {
	let className = `css-button-${name}`;
	if (!enabled) className += ' css-button-disabled';
	return <button className={className} onClick={enabled ? onClick : null}></button>;
};

const ScrollButtons = ({ enableScrollUp, scrollUp, enableScrollDown, scrollDown }) =>
	<nav className='css-scroll-buttons'>
		<ScrollButton name='up' enabled={enableScrollUp} onClick={scrollUp} />
		<ScrollButton name='down' enabled={enableScrollDown} onClick={scrollDown} />
	</nav>;


// MAIN APP

class App extends Component {

	constructor (props) {
		super(props);
		this.state = {
			darkJedis: darkJediStore.getAll(),
			planet: planetStore.get()
		};
		this.darkJediStoreChanged = this.darkJediStoreChanged.bind(this);
		this.planetStoreChanged = this.planetStoreChanged.bind(this);
		this.getDarkJediIfNeeded = this.getDarkJediIfNeeded.bind(this);
		this.queueRequest = this.queueRequest.bind(this);
		this.queueNextMasters = this.queueNextMasters.bind(this);
		this.queueNextApprentices = this.queueNextApprentices.bind(this);
		this.scrollUp = this.scrollUp.bind(this);
		this.scrollDown = this.scrollDown.bind(this);
		this.requestQueue = [];
	}

	// Custom methods
	// ==============

	// Check the request queue to load next dark jedi if needed
	getDarkJediIfNeeded () {
		if (this.requestQueue.length === 0) return;
		const { action, data } = this.requestQueue.shift(),
			{ source, target } = data;
		// Check if the data needed to get the next is loaded or try again in 1 second
		if (!Object.keys(this.state.darkJedis[source]).length) return setTimeout(this.getDarkJediIfNeeded, 1000);
		// Use specified action to get master or apprentice
		// from specified dark jedi in currently loaded list
		this[action](this.state.darkJedis[source], target);
	}

	// Get the apprentice of specified dark jedi
	getApprentice (darkJedi, slot) {
		apiActionCreator.getDarkJedi(darkJedi.apprentice.id, slot);
	}

	// Get the master of specified dark jedi
	getMaster (darkJedi, slot) {
		apiActionCreator.getDarkJedi(darkJedi.master.id, slot);
	}

	// Add request to queue
	queueRequest (action, data) {
		this.requestQueue.push({ action, data });
	}

	queueNextMasters () {
		this.queueRequest('getMaster', { source: 2, target: 1 });
		this.queueRequest('getMaster', { source: 1, target: 0 });
	}

	queueNextApprentices () {
		this.queueRequest('getApprentice', { source: 2, target: 3 });
		this.queueRequest('getApprentice', { source: 3, target: 4 });
	}

	// Update dark jedi list from store
	darkJediStoreChanged () {
		this.setState({
			darkJedis: darkJediStore.getAll()
		});
		setTimeout(this.getDarkJediIfNeeded, 1000);
	}

	// Update current planet from store
	planetStoreChanged () {
		this.setState({
			planet: planetStore.get()
		});
	}

	scrollUp () {
		darkJediActionCreator.scrollUp();
		this.queueNextMasters();
	}

	scrollDown () {
		darkJediActionCreator.scrollDown();
		this.queueNextApprentices();
	}

	// React Lifecycle methods
	// =======================

	componentDidMount () {
		darkJediStore.addChangeListener(this.darkJediStoreChanged);
		planetStore.addChangeListener(this.planetStoreChanged);
		// Initialize WebSocket connection
		wsActionCreator.initializeConnection();
		// Load initial darkJedi data into slot with index 2 & start interval to load next data
		apiActionCreator.getDarkJedi(INITIAL_DARKJEDI_ID, 2);
		// Queue the following requests based on the response of the previous
		this.queueNextApprentices();
		this.queueNextMasters();
	}

	componentWillUnmount () {
		darkJediStore.removeChangeListener(this._onChange);
	}

	render () {
		const { state } = this,
			{ planet, darkJedis } = state,
			firstSlot = darkJedis[0],
			lastSlot = darkJedis[darkJedis.length - 1];
		return (
			<main className='css-root'>
				<PlanetMonitor planetName={planet.name} />
				<section className='css-scrollable-list'>
					<DarkJediList darkJedis={darkJedis} currentPlanetId={planet.id} />
					<ScrollButtons
						scrollUp={this.scrollUp}
						enableScrollUp={firstSlot.master && firstSlot.master.url}
						scrollDown={this.scrollDown}
						enableScrollDown={lastSlot.apprentice && lastSlot.apprentice.url} />
				</section>
			</main>
		);
	}

}

ReactDOM.render(<App />, document.getElementById('app'));

