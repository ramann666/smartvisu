/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU - Converter for CCU-Jack driver
 * @author      raman
 * @copyright   2022
 * @license     GPL [http://www.gnu.de]
 * @version     1.0.0
 * -----------------------------------------------------------------------------

var converter = {
	//add function to replace characters for incoming message, i.e. use regular expression
	messageIn: function (item, message) {	
		if (typeof message.v === 'number') {
			if (item.indexOf(".LEVEL") !== -1) {
				return (Math.round(message.v * 100)).toString();
			} else {
				return message.v.toString();
			}
		}
		else if (typeof message.v === 'boolean') {
			return message.v == true ? 1 : (message.v == false ? 0 : message.v.toString());
		} else {
			return message.v.toString();
		}
	},
	
	//add function to replace characters for outgoing message
	messageOut: function (item, val) {	
		if (typeof val === 'string' || val instanceof String) {
			if (item.indexOf(".LEVEL") !== -1) {
				return (Math.round(val / 100));
			} else {
				return val === '1' ? true : (val === '0' ? false : val);
			}
		}
		else if (typeof val === 'number') {
			if (item.indexOf(".LEVEL") !== -1) {
				return (Math.round(val / 100));
			} else {
				return val;
			}
		} else {
			return val;
		}
	}
}
