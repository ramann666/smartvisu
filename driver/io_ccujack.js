/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU
 * @author      raman
 * @copyright   2022
 * @license     GPL [http://www.gnu.de]
 * @version     1.0.0
 * -----------------------------------------------------------------------------
 * @label       CCU-Jack
 *
 * @default     driver_port             2121
 * @default     driver_tlsport          2122
 * @default     driver_realtime         true
 * @hide        driver_autoreconnect
 * @default     driver_username         username
 * @default     driver_password         password
 * @hide        driver_consoleport 
 * @hide        driver_consoleusername
 * @hide        driver_consolepassword
 * @hide        reverseproxy
 * @hide        sv_hostname
 * @hide        proxy
 * @hide        proxy_url
 * @hide        proxy_user
 * @hide        proxy_password
 */

/**
 * Class for controlling all communication with a connected system. There are
 * simple I/O functions, and complex functions for real-time values.
 */
var io = {

	//  debug switch
	debug: true,
	
	counter: 0,

	// refreshtimer object
	timer: null,
	
	//  is timer running?
	timer_run: false,
	
	// timeout timer in seconds
	timeout: 1,
	
	// servertimeout in seconds
	requestTimeout: 5,
	
	//  adress
	url: '',

	// -----------------------------------------------------------------------------
	// P U B L I C   F U N C T I O N S
	// -----------------------------------------------------------------------------

	/**
	 * Does a read-request and adds the result to the buffer
	 *
	 * @param      the item
	 */
	read: function (item) {
		io.debug && console.log("[io.ccujack]: io.read(item = " + item + ")");
		var device = item.replace(/\./g, "/");
		io.debug && console.log("[io.ccujack]: io.read(item = " + device + ")");
		
		var msg = {};
		msg.item = item;
		
		io.request('GET', io.url + '/' + device + '/~pv', msg, io.updateItem);
	},

	/**
	 * Does a write-request with a value
	 *
	 * @param      the item
	 * @param      the value
	 */
	write: function (item, val) {
		io.debug && console.log("[io.ccujack]: io.write(item = " + item + ", val = " + val + ")");
		
		var device = item.replace(/\./g, "/");
		//call converter
		var state = converter.messageOut(item, val);
		
		var msg = {};
		msg.state = '{"v":' + state + '}';
		msg.item = item;
		msg.val = val;
		
		io.debug && console.debug("[io.ccujack]: io.write(item = " + device + ", val = " + state + ")");
		io.request('PUT', io.url + '/' + device + '/~pv', msg, io.updateItem);
	},

	/**
	 * Execute a program on CCU
	 *
	 * @param      command
	 * @param      options
	 */
	trigger: function (name, val) {
		io.debug && console.log("[io.ccujack]: io.trigger(name = " + name + ", val = " + val + ")");
		
		var device = name.replace(/\./g, "/");
		
		var msg = {};
		msg.item = name;
		
		if (name.indexOf("program") !== -1) {
			msg.state = '{"v": true}';
			
		} else if (name.indexOf("sysvar") !== -1) {
			msg.state = '{"v": ' + val + '}';
		}
		
		io.request('PUT', io.url + '/' + device + '/~pv', msg, io.updateItem);
	},

	/**
	 * Initializion of the driver
	 *
	 * Driver config parameters are globally available as from v3.2
	 */
	init: function () {
		!io.debug && console.info("[io.ccujack]: Type 'io.debug=true;' to console to see more details.");
		io.debug && console.log("[io.ccujack]: io.init()");
	
		io.requestTimeout *= 1000;

		if (!sv.config.driver) {
			sv.config['driver'] = {
				address : arguments[0],
				port    : arguments[1]
			};
		}

		io.debug && console.debug("[io.ccujack]: io.init(address = " + sv.config.driver.address + ", port = " + (sv.config.driver.ssl ? sv.config.driver.tlsport : sv.config.driver.port) + ", ssl = " + sv.config.driver.ssl + ", username = " + sv.config.driver.username + ", password = " + sv.config.driver.password + ")");

		if (sv.config.driver.ssl == true) {
			io.url = 'https://' + sv.config.driver.address + (sv.config.driver.tlsport ? ":" + sv.config.driver.tlsport : '');
		} else {
			io.url = 'http://' + sv.config.driver.address + (sv.config.driver.port ? ":" + sv.config.driver.port : '');
		}
		
		io.debug && console.debug("[io.ccujack]: url = " + io.url);
		io.request('GET', io.url, {}, io.isRequest);
	},

	/**
	 * Lets the driver work
	 */
	run: function () {
		io.debug && console.log("[io.ccujack]: io.run(realtime = " + sv.config.driver.realtime + ")");
		io.stop();
		
		// refresh all widgets with values from the buffer
		widget.refresh();

		// get item updates from the backend
		io.monitor();
	},


	// -----------------------------------------------------------------------------
	// C O M M U N I C A T I O N   F U N C T I O N S
	// -----------------------------------------------------------------------------
	// The functions in this paragraph may be changed. They are all private and are
	// only be called from the public functions above. You may add or delete some
	// to fit your requirements and your connected system.
	
	/**
	 * The real-time polling loop, only if there are listeners
	 */
	loop: function () {
		if (widget.listeners().length) {
			io.timer = setTimeout('io.loop(); io.monitor();', io.timeout * 1000);
			io.counter++;
		}
	},

	/**
	 * Start the real-time values. Can only be started once
	 */
	start: function () {
		if (!io.timer_run && widget.listeners().length) {
			io.loop();
			io.timer_run = true;
		}
	},

	/**
	 * Stop the real-time values
	 */
	stop: function () {
		clearTimeout(io.timer);
		io.timer_run = false;
		io.counter = 0;
	},
	
	/**
	 * Closes the connection
	 */
	close: function () {
		io.debug && console.log("[io.ccujack] close connection");
		io.stop();
		io.monitor();
	},
	
	/**
	 * Update the real-time values for active widgets
	 */
	monitor: function () {
		io.debug && console.log("[io.ccujack]: io.monitor(realtime = " + sv.config.driver.realtime + ")");
		
		var items = widget.listeners();
		var series = widget.series();
		var logs = widget.logs();
		
		if (items.length) {
			var msg = {};
			var readPaths = [];
			for (var i = 0; i < items.length; i++) {
				// prevent request from uzsu items
				var uzsu = io.uzsu(items[i]);
				if(!uzsu) {
					readPaths[i] = '/' + items[i].replace(/\./g, "/");
				}
			}
			msg.readPaths = readPaths;
			msg.items = items;
			
			io.request('PUT', io.url + '/~exgdata', msg, io.updateItems);
		}
		
		if (series.length) {
			//ToDo
		}
				
		if (logs.length && (io.counter < 1 || io.counter > Math.round((60/io.timeout)*5))) {
			io.counter = 0;
			
			var msg = {};
			var readPaths = [];
			for (var i = 0; i < logs.length; i++) {
				readPaths[i] = '/' + logs[i].item.replace(/\./g, "/");
			}
			msg.readPaths = readPaths;
			msg.items = logs;
		
			io.request('PUT', io.url + '/~exgdata', msg, io.updateLogs);
		}
		if (!logs.length) {
			io.counter = -1;
		}
	},
	
	/**
	 * Send a request to the server
	 *
	 * @param      method
	 * @param      url
	 * @param      message
	 * @param      callback
	 */
	request: function (method, url, msg, callback) {
		io.debug && console.log("[io.ccujack]: io.request(method = " + method + ")");
		
		var xhr = new XMLHttpRequest();
		xhr.withCredentials = false;
		xhr.open(method, url, true);
		xhr.timeout = io.requestTimeout;
		if (sv.config.driver.username) {xhr.setRequestHeader('Authorization', "Basic " + btoa(sv.config.driver.username + ':' + sv.config.driver.password))};
		xhr.setRequestHeader('Content-type', 'application/json; charset=utf-8');
		xhr.onload = function () {
			if (xhr.readyState == 4 && xhr.status == "200") {
				callback(msg, this.responseText);
			} else if(xhr.readyState == 4 && xhr.status == "201") {
				io.debug && console.log("[io.ccujack]: created object");
			} else {
				io.debug && console.log("[io.ccujack]: Error:");
				io.debug && console.log(this);
				if (notify.exists) {
					io.debug && console.log("[io.ccujack]: request - notify exists");
				}
				
				var error = this.status;
				
				switch (this.status) {
					case '400':
						error = "Ungueltige Anfrage (HTTP-Protokollfehler).";
					break;
					case '401':
						error = "(Benutzer-)Authentifizierung noetig.";
					break;
					case '403':
						error = "Zugriffsrechte fehlen.";
					break;
					case '404':
						error = "Objekt/Dienst nicht vorhanden.";
					break;
					case '422':
						error = "Anfrage entspricht nicht dem VEAP-Protokoll.";
					break;
					case '500':
						error = "Unerwarteter Fehler im Server.";
					break;
				}
				
				notify.error('HTTP-Error', error);
			}
		}
			
		xhr.ontimeout = function (e) {
			io.debug && console.log("[io.ccujack]: response timeout");
		}
		
		switch (method) {
			case 'GET':
				xhr.send(null);
				break;
			case 'PUT':
				if (url.endsWith('~exgdata')) {
					xhr.send(JSON.stringify(msg));
				} else {
					xhr.send(msg.state);
				}
				break;
		}
	},
	
	/**
	 * Callback initial request
	 *
	 * @param      message
	 * @param      response
	 */
	isRequest: function (msg, response) {
		io.debug && console.log("[io.ccujack]: io.isRequest()");
		
		try {
			var data = JSON.parse(response);
			
			if (data.description !== "Root of the CCU-Jack VEAP server" && data.identifier !== "root") {
				sv.config.driver.realtime = false;
			}
		} catch (e) {
			io.debug && console.log("[io.ccujack]: io.isRequest() - JSON: "  + sv_lang.status_event_format.error.parsererror);
		}
	},
	
	/**
	 * Callback single item
	 *
	 * @param      message
	 * @param      response
	 */
	updateItem: function (msg, response) {
		io.debug && console.log("[io.ccujack]: io.updateItem(" + msg.item + ", " + msg.val + ")");

		if (response) {
			try {
				var data = JSON.parse(response);
				//call converter
				var val = converter.messageIn(msg.item, data);
				widget.update(msg.item, val);
			} catch (e) {
				io.debug && console.log("[io.ccujack]: io.updateItem() - JSON: "  + sv_lang.status_event_format.error.parsererror);
			}
		} else {
			if (msg.item) {
				widget.update(msg.item, msg.val);
			}
		}
	},
	
	/**
	 * Callback items
	 *
	 * @param      message
	 * @param      response
	 */
	updateItems: function (msg, response) {
		io.debug && console.log("[io.ccujack]: io.updateItems(" + JSON.stringify(msg.items) + ")");

		if (response) {
			try {
				var exgdata = JSON.parse(response);
				if (exgdata.readResults.length) {
					for (var i = 0; i < exgdata.readResults.length; i++) {
						if (exgdata.readResults[i].pv && exgdata.readResults[i].pv.s < 100) {
							var item = msg.items[i];
							//call converter
							var val = converter.messageIn(item, exgdata.readResults[i].pv);
							
							if(!io.timer_run) {
								widget.update(item,val);
							} else if(widget.get(item).toString() !== val.toString()) {
								widget.update(item,val);
							}
							
						} else if(exgdata.readResults[i].error) {
							io.debug && console.log("[io.ccujack]: io.updateItems() - Error - Code: "  + exgdata.readResults[i].error.code + ", Message: " + exgdata.readResults[i].error.message);
						}
					}
					//start timer after first response
					if(sv.config.driver.realtime && !io.timer_run) {
						io.start();
					}
				}
			} catch (e) {
				io.debug && console.log("[io.ccujack]: io.updateItems() - JSON: "  + sv_lang.status_event_format.error.parsererror);
			}
		}  else {
			io.debug && console.log("[io.ccujack]: io.updateItems() - No response");
		}
	},
	
	/**
	 * Callback series
	 *
	 * @param      message
	 * @param      response
	 */	
	updateSeries: function (msg, response) {
		io.debug && console.log("[io.ccujack]: io.updateSeries()");
		$.noop;
		//ToDo
	},
	
	/**
	 * Callback logs
	 *
	 * @param      message
	 * @param      response
	 */
	updateLogs: function (msg, response) {
		io.debug && console.log("[io.ccujack]: io.updateLogs()");

		if (response) {
			try {
				var exgdata = JSON.parse(response);
				if (exgdata.readResults.length) {
					for (var i = 0; i < exgdata.readResults.length; i++) {
						if (exgdata.readResults[i].pv && exgdata.readResults[i].pv.s < 100) {
							var item = msg.items[i].item;
							var count = msg.items[i].count * 1;
							var val = exgdata.readResults[i].pv.v
							var logdata = JSON.parse(val);
							logdata.sort((a, b) => { return new Date(b.time).getTime() - new Date(a.time).getTime(); });
							logdata.splice(count, logdata.length - 1);
							widget.update(item,logdata);
						} else if(exgdata.readResults[i].error) {
							io.debug && console.log("[io.ccujack]: io.updateLogs() - Error - Code: "  + exgdata.readResults[i].error.code + ", Message: " + exgdata.readResults[i].error.message);
						}					
					}
					//start timer after first response
					if(sv.config.driver.realtime && !io.timer_run) {
						io.start();
					}
				}
			} catch (e) {
				io.debug && console.log("[io.ccujack]: io.updateItems() - JSON: "  + sv_lang.status_event_format.error.parsererror);
				io.debug && console.log(e);
			}
		}  else {
			io.debug && console.log("[io.ccujack]: io.updateItems() - No response");
		}
	},

	/**
	 * stop all subscribed series
	 */
	stopseries: function () {
		io.debug && console.log("[io.ccujack]: io.stopseries()");
		$.noop;
		//ToDo
	},
	
	uzsu: function (item) {
		var ret = false;
		if (item) {
			$(":mobile-pagecontainer").pagecontainer( "getActivePage" ).find('[data-widget^="device.uzsu"][data-item*="' + item + '"]').each(function (idx) {
				var items = widget.explode($(this).attr('data-item'));
				for (var i = 0; i < items.length; i++) {
					if (items[i] == item) {
						ret = true;
					}
				}
			})
		}
		return ret;
	}
}
