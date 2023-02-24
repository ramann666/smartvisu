/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU
 * @author      ramann
 * @copyright   2022
 * @license     GPL [http://www.gnu.de]
 * -----------------------------------------------------------------------------
 * @label       pureFHEM
 *
 * @default     driver_autoreconnect   false
 * @default     driver_port            2121
 * @hide        driver_tlsport
 * @hide        driver_ssl
 * @hide        driver_username
 * @hide        driver_password 
 * @hide        driver_tlsport
 * @hide        driver_realtime
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
 
 var io = {
	 
	 //  debug switch
	debug: true,

	autoreconnect: '',
	
	uzsu_type: '2',

	// -----------------------------------------------------------------------------
	// P U B L I C   F U N C T I O N S
	// -----------------------------------------------------------------------------

	/**
	 * Does a read-request and adds the result to the buffer
	 *
	 * @param      the item
	 */
	read: function (item) {
		io.debug && console.log('ioFHEM: read - item: ' + item);
		if (io.isConnected) {
			var msg = {};
			msg.cmd = 'monitor';
			msg.items = [item];
			io.send(msg);
		}
	},

	/**
	 * Does a write-request with a value
	 *
	 * @param      the item
	 * @param      the value
	 */
	write: function (item, val) {
		io.debug && console.log('ioFHEM: write - item: ' + item + ' val: ' + JSON.stringify(val));
		if (io.isConnected) {
			var msg = {};
			msg.cmd = 'item';
			msg.id = item;
			msg.val = val;
			io.send(msg);
		}
	},

	/**
	 * Trigger a logic
	 *
	 * @param      the logic
	 * @param      the value
	 */
	trigger: function (item, val) {
		// not supported in fronthem --> send a write message
		io.debug && console.log('ioFHEM: trigger - item: ' + item + ' val: ' + val);
		if (io.isConnected) {
			var msg = {};
			//msg.cmd = 'trigger';
			msg.cmd = 'item';
			msg.item = item;
			msg.val = val;
			io.send(msg);
		}
	},
	
		/**
	 * Initializion of the driver
	 *
	 * @param      the ip or url to the system (optional)
	 * @param      the port on which the connection should be made (optional)
	 */
	init: function () {
		if (!sv.config.driver) { //Kompatibiliät zu smartVISU <= 3.1
			sv.config['driver'] = {
				address : arguments[0],
				port    : arguments[1]
			};
		}
		
		if (location.protocol == 'https:') {
			io.url = 'wss://' + sv.config.driver.address + (sv.config.driver.port ? ":" + sv.config.driver.port + '/ws' : '');
		} else {
			io.url = 'ws://' + sv.config.driver.address + (sv.config.driver.port ? ":" + sv.config.driver.port  + '/ws' : '');
		}
		
		io.debug && console.log('ioFHEM: init socket');
		io.debug && console.log(io.url);
		io.open();
	},

	/**
	 * Lets the driver work
	 */
	run: function (realtime) {
		// old items
		widget.refresh();

		// new items		
		if (io.isConnected) {
			io.monitor();
		}
	},
	
	/**
	 * This driver uses a websocket
	 */
	socket: false,

	isConnected: false,
	
	protocolVersion: '0.1',
	
	checkConnected() {
		if (!io.socket) {
			io.debug && console.log('ioFHEM: No Connection to socket');
			io.isConnected = false;
			return false;
		}			
		else if (io.socket) {
			switch (io.socket.readyState) {
				case 1:
					io.isConnected = true;
					io.debug && console.log('ioFHEM: Socket open');
					break;
				case 3:
					io.isConnected = false;
					io.debug && console.log('ioFHEM: Socket closed');
					break;
			}
			return io.isConnected;
		}
	},

	/**
	 * Opens the connection and add some handlers
	 */
	open: function () {
		io.socket = new WebSocket(io.url);
		//io.debug && console.log(io.socket);
		
		io.socket.onopen = () => {
			io.checkConnected();
			io.send({
				'cmd': 'proto',
				'ver': io.protocolVersion
			});
			io.run();
		}
		
		io.socket.onerror = (error) => {
			io.checkConnected();
			io.debug && console.log('ioFHEM: error: ' + error);
		}
 
		io.socket.onmessage = (message) => {
			io.recieve(message);
		}
		
		io.socket.onclose = () => {
			io.checkConnected();
		}
	},
	 
	close: function () {
		io.debug && console.log('ioFHEM: close connection');
		io.checkConnected();
		if (io.isConnected) {
			io.socket.close(1000);
		}
	},
	
	monitor: function() {
		io.debug && console.log('ioFHEM: monitor');
		io.checkConnected();
		var items = widget.listeners();
		var series = widget.series();
		var logs = widget.logs();
		
		if (io.isConnected && items.length) {
			io.send({
				'cmd': 'monitor',
				'items': items
			});
		}
		
		if (io.isConnected && series.length) {
			//add information for interval and updatemode to all series
			for (var i=0; i<series.length; i++) {
				series[i].interval = 'OnChange';
				series[i].updatemode = 'complete';
			}
			io.send({
				'cmd': 'plot',
				'items': series
			});
		}
		
		// { item: "log_name", count: "10" }
		if (io.isConnected && logs.length) {	
			io.send({
				'cmd': 'log',
				'items': logs
			});
		}
		
	},
	
	send: function(msg) {
		//io.debug && console.log(JSON.stringify(msg));
		io.socket.send(JSON.stringify(msg));
	},
	
	recieve: function(message) {
		try {
			var msg = JSON.parse(message.data);
			//io.debug && console.log(msg);
			if(msg.cmd) {
				switch (msg.cmd) {
					case 'reloadPage':
						location.reload(true);
						break;
      
					case 'item':
						for (i = 0; i < msg.items.length; i = i + 2) {
							widget.update(msg.items[i], msg.items[i + 1]);
						}
						break;
					case 'plot':
						for (i = 0; i < msg.items.length; i++) {
							if(msg.items[i]) {
								widget.update(msg.items[i].item, msg.items[i].plotdata);
							}
						}
						break;
					case 'series':
						for (i = 0; i < msg.items.length; i++) {
							var dataItem = msg.items[i];
							widget.update(msg.items[i].item, msg.items[i].plotdata);
						}
						break;
					case 'log':
						for (i = 0; i < msg.items.length; i = i + 2) {
							widget.update(msg.items[i], msg.items[i + 1]);
						}
						break;
					case 'dialog':
						notify.info(msg.header, msg.content);
						break;
					case 'proto':
						var proto = msg.ver;
						if (proto != io.protocolVersion) {
							notify.info('Driver: fhem',
							'Protocol mismatch<br />Driver is at version v' + io.	protocolVersion + '<br />fhem is at version v' + proto);
						}
						break;
				}
			}
			
		} catch {
			io.debug && console.log('ioFHEM: message - json mismatch');
		}
	},
	
	/**
	 * stop all subscribed series
	 */
	stopseries: function () {
		// not supported
		$.noop;
	}
 }
