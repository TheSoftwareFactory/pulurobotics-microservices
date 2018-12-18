/**
* messaging.js
*/

const assert = require("assert").strict;

// Public constants
const TYPE_LIDAR_LOWRES = 131;
const TYPE_DBG = 132;
const TYPE_SONAR = 133;
const TYPE_BATTERY = 134;
const TYPE_ROUTEINFO = 135;
const TYPE_SYNCREQ = 136;
const TYPE_DBGPOINT = 137;
const TYPE_HMAP = 138;
const TYPE_INFOSTATE = 139;
const TYPE_ROBOTINFO = 140;
const TYPE_LIDAR_HIGHRES = 141;
const TYPE_PICTURE = 142;
const TYPE_MOVEMENT_STATUS = 143;
const TYPE_ROUTE_STATUS = 144;
const TYPE_STATEVECT = 145;
const TYPE_LOCALIZATION_RESULT = 146;

// Private constants
const BIN_HEADER_LENGTH = 3;
const STATE_VECT_LENGTH = 16;

/**
* Encode a binary message.
* @opcode - The opcode of the message.
* @format - A string describing how to encode the data.
*  - b: signed char, 1 byte
*  - B: unsigned char, 1 byte.
*  - H: unsigned short, 2 bytes.
*  - i: signed integer, 4 bytes.
*  The encoding is always big-endian.
* @data {...*} - A variable number of arguments with the data.
* @returns A Buffer with the encoded message.
*/
function encodeBinaryMessage() {
    assert(arguments.length >= 1, "Must specify at least a message opcode");
    
    var opcode = arguments[0];

    assert(opcode != undefined, "Message opcode must be defined");

    if (arguments.length == 1) {
	// message without payload
	var buffer = Buffer.alloc(3);
	buffer.writeUIntBE(opcode, 0, 1);
	buffer.writeUIntBE(0, 2);
	return buffer;
    }
    
    var format = arguments[1];

    assert(format.length == arguments.length - 2, "Number of format string items must match number of data arguments");
    
    // count the length of the data as per the format string
    var data_length = 0;
    for (var i = 0; i < format.length; i++) {
	switch (format[i]) {
	case "b":
	    data_length += 1;
	    break;
	case "B":
	    data_length += 1;
	    break;
	case "H":
	    data_length += 2;
	    break;
	case "i":
	    data_length += 4;
	    break;
	}
    }

    // construct the message
    var buffer = Buffer.alloc(BIN_HEADER_LENGTH + data_length);

    // construct header
    buffer.writeUIntBE(opcode, 0, 1);
    buffer.writeUIntBE(data_length, 1, 2);
    
    // loop through the remaining arguments and encode them
    var pos = 3; // first position to write data to
    for (var i = 0; i < format.length; i++) {
	var data = arguments[i+2]; // first 2 arguments already done

	switch(format[i]) {
	case "b":
	    buffer.writeIntBE(data, pos, 1);
	    pos += 1;
	    break;
	case "B":
	    buffer.writeUIntBE(data, pos, 1);
	    pos += 1;
	    break;
	case "H": // unsigned short, 2 bytes
	    buffer.writeUIntBE(data, pos, 2);
	    pos += 2;
	    break;
	case "i": // signed int, 4 bytes
	    buffer.writeIntBE(data, pos, 4);
	    pos += 4;
	    break;
	}
    }

    return buffer;
}

/**
* Decode a message.
* @param data - A buffer containing the message data.
* @returns An Object with the decoded message.
*/
function decodeMessage(msgdata) {
    assert(msgdata != undefined, "Must specify data");

    var opcode = msgdata.readUIntBE(0, 1);
    var length = msgdata.readUIntBE(1, 2);
    var data = msgdata.slice(3);

    var message = {
	type: opcode,
	length: length
    };

    switch(opcode) {
    case TYPE_LIDAR_LOWRES:
	console.log("decoding TYPE_LIDAR_LOWRES");
	console.log("message dump follows");
	console.log(data);
	
	message.robot_angle = data.readIntBE(0, 2) / 65536.0 * 360.0;
	message.robot_x = data.readIntBE(2, 4);
	message.robot_y = data.readIntBE(6, 4);
	message.lidar_points = [];

	var num_points = (length - 10) / 2;

	try {
	    for (var i = 0; i < num_points; i++) {
		var x = data.readIntBE(10 + 2 * i, 1) * 160 + message.robot_x;
		var y = data.readIntBE(10 + 2 * i + 1, 1) * 160 + message.robot_y;
		message.lidar_points.push([x, y])
	    }
	} catch (err) {
	    console.warn("Error while parsing lidar lowres points");
	    console.warn(err);
	}
	break;
    case TYPE_DBG:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);
	message.debug_data = [];
	for (var i = 0; i < 10; i++) {
	    message.debug_data.push(data.readIntBE(i, 2));
	}
	break;
    case TYPE_SONAR:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);
	message.sonar_x = data.readIntBE(0, 4);
	message.sonar_y = data.readIntBE(4, 4);
	message.sonar_z = data.readIntBE(8, 4);
	message.sonar_c = data.readIntBE(9, 1);
	break;
    case TYPE_BATTERY:
	message.charging = data.readIntBE(0, 1) & 1;
	message.charge_finished = data.readIntBE(0, 1) & 2;
	message.battery_voltage = data.readIntBE(1, 2) / 1000.0;
	message.battery_percentage = data.readIntBE(3, 1);
	message.charge_voltage = data.readIntBE(4, 2) / 1000.0;
	break;
    case TYPE_ROUTEINFO:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);
	message.route_start_x = data.readIntBE(0, 4);
	message.route_start_y = data.readIntBE(4, 4);

	var num_elements = length / 9;
	message.route_points = [];
	
	for (var i = 0; i < num_elements; i++) {
	    var point = {}
	    point.backmode = data.readIntBE(i * 9 + 8, 1);
	    point.x = data.readIntBE(i * 9 + 9, 4);
	    point.y = data.readIntBE(i * 9 + 13, 4);
	    message.route_points.push(point);
	}
	break;
    case TYPE_SYNCREQ:
	// This message has no payload
	break;
    case TYPE_DBGPOINT:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);
	if (data.readIntBE(11, 1) == 0) {
	    message.debug_point_x = data.readIntBE(0, 4);
	    message.debug_point_y = data.readIntBE(4, 4);
	    message.debug_point_r = data.readIntBE(8, 1);
	    message.debug_point_g = data.readIntBE(9, 1);
	    message.debug_point_b = data.readIntBE(10, 1);
	} else {
	    message.pers_debug_point_x = data.readIntBE(0, 4);
	    message.pers_debug_point_y = data.readIntBE(4, 4);
	    message.pers_debug_point_r = data.readIntBE(8, 1);
	    message.pers_debug_point_g = data.readIntBE(9, 1);
	    message.pers_debug_point_b = data.readIntBE(10, 1);
	}
	break;
    case TYPE_HMAP:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);
	message.hmap_xsamples = data.readIntBE(0, 2);
	message.hmap_ysamples = data.readIntBE(2, 2);
	if (message.hmap_xsamples < 1 ||
	    message.hmap_xsamples > 256 ||
	    message.hmap_ysamples < 1 ||
	    message.hmap_ysamples > 256) {
	    message.hmap_invalid = true;
	    return undefined; // TODO: confirm that this is a good way to signal invalid data
	}
	message.robot_angle = data.readIntBE(4, 2) / 65536.0 * 360.0;
	message.robot_x = data.readIntBE(6, 4);
	message.robot_y = data.readIntBE(10, 4);
	message.hmap_unit_size = data.readIntBE(14, 1);
	message.hmap_data = Buffer.alloc(message.hmap_xsamples * message.hmap_ysamples);
	data.copy(message.hmap_data, 0, 15);
	break;
    case TYPE_INFOSTATE:
	// TODO: check
	// TODO: consider a lookup table instead
	console.log(`Opcode ${opcode} not verified.`);
	var info_state = data.readIntBE(0, 1);
	if (info_state == -1) {
	    message.info_state = "undefined";
	} else if (info_state == 0) {
	    message.info_state = "idle";
	} else if (info_state == 1) {
	    message.info_state = "think";
	} else if (info_state == 2) {
	    message.info_state = "forward";
	} else if (info_state == 3) {
	    message.info_state = "reverse";
	} else if (info_state == 4) {
	    message.info_state = "left";
	} else if (info_state == 5) {
	    message.info_state = "right";
	} else if (info_state == 6) {
	    message.info_state = "charging";
	} else if (info_state == 7) {
	    message.info_state = "daijuing";
	} else {
	    return undefined; // TODO: confirm that this is a good way to signal invalid data
	}
	break;
    case TYPE_ROBOTINFO:
	// TODO: check
	try {
	    console.log(`Opcode ${opcode} not verified.`);
	    message.robot_size_x = data.readIntBE(0, 2);
	    message.robot_size_y = data.readIntBE(2, 2);
	    message.lidar_offset_x = data.readIntBE(4, 2);
	    message.lidar_offset_y = data.readIntBE(6, 2);
	} catch (err) {
	    console.warn("Error while parsing robot info");
	    console.warn(err);
	}
	break;
    case TYPE_PICTURE:
	console.log(`Opcode ${opcode} not verified.`);
	break;
    case TYPE_LIDAR_HIGHRES:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);

	message.robot_angle = data.readIntBE(0, 2) / 65536 * 360;
	message.robot_x = data.readIntBE(2, 4);
	message.robot_y = data.readIntBE(6, 4);
	message.lidar_points = [];

	var num_points = (length - 10) / 4;

	for (var i = 0; i < num_points; i++) {
	    var x = data.readIntBE(10 + 4 * i, 2) + message.robot_x;
	    var y = data.readIntBE(10 + 4 * i + 2, 2) + message.robot_y;
	    message.lidar_points.push([x, y])
	}
	break;
    case TYPE_MOVEMENT_STATUS:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);
	
	message.start_angle = data.readIntBE(0, 2);
	message.start_x = data.readIntBE(2, 4);
	message.start_y = data.readIntBE(6, 4);
	message.requested_x = data.readIntBE(10, 4);
	message.requested_y = data.readIntBE(14, 4);
	message.requested_backmode = data.readIntBE(18, 1);
	message.current_angle = data.readIntBE(19, 2);
	message.current_x = data.readIntBE(21, 4);
	message.current_y = data.readIntBE(25, 4);
	message.statuscode = data.readIntBE(29, 1);
	if (message.statuscode == 0) {
	    message.success = true;
	} else {
	    message.success = false;
	}
	message.hardware_obstacle_flags = data.readIntBE(30, 4);
	break;
    case TYPE_ROUTE_STATUS:
	// TODO: check
	/* TODO: consider how to handle status code descriptions:
	   0: Success
	   1: Obstacles on map close to the beginning, can't get started
	   2: Got a good start thanks to backing off, but obstacles on the way later
	   3: Got a good start, but obstacles on the way later
	   4: Unknown (newly implemented?) reason
	   Or whether not to include them at all.
	*/
	console.log(`Opcode ${opcode} not verified.`);

	message.start_angle = data.readIntBE(0, 2);
	message.start_x = data.readIntBE(2, 4);
	message.start_y = data.readIntBE(6, 4);
	message.requested_x = data.readIntBE(10, 4);
	message.requested_y = data.readIntBE(14, 4);
	message.current_angle = data.readIntBE(18, 2);
	message.current_x = data.readIntBE(20, 4);
	message.current_y = data.readIntBE(24, 4);
	message.statuscode = data.readIntBE(28, 1);
	if (message.statuscode == 0) {
	    message.success = true;
	} else {
	    message.success = false;
	}
	message.reroute_count = data.readIntBE(29, 2);
	break;
    case TYPE_STATEVECT:
	// TODO: check
	console.log(`Opcode ${opcode} not verified.`);

	var state_vector_fields = [
	    {name: "localization_2d"},
	    {name: "localization_3d"},
	    {name: "mapping_2d"},
	    {name: "mapping_3d"},
	    {name: "collision_mapping"},
	    {name: "motors_on"},
	    {name: "autonomous_exploration"},
	    {name: "big_localization_area"},
	    {name: "reserved2"},
	    {name: "reserved3"},
	    {name: "reserved4"},
	    {name: "reserved5"},
	    {name: "reserved6"},
	    {name: "reserved7"},
	    {name: "reserved8"},
	    {name: "reserved9"}
	];

	for (var i = 0; i < STATE_VECT_LENGTH; i++) {
	    var tmp = data.readIntBE(i, 1);
	    if (tmp == 0) {
		state_vector_fields[i].data = false;
	    } else {
		state_vector_fields[i].data = true;
	    }
	}

	for (var entry of state_vector_fields) {
	    message[entry.name] = entry.data;
	}
	
	break;
    case TYPE_LOCALIZATION_RESULT:
	// TODO: How does this work? Is it needed?
	console.log(`Opcode ${opcode} not verified.`);
	break;
    }

    return message;
}

module.exports = {
    TYPE_LIDAR_LOWRES,
    TYPE_DBG,
    TYPE_SONAR,
    TYPE_BATTERY,
    TYPE_ROUTEINFO,
    TYPE_SYNCREQ,
    TYPE_DBGPOINT,
    TYPE_HMAP,
    TYPE_INFOSTATE,
    TYPE_ROBOTINFO,
    TYPE_LIDAR_HIGHRES,
    TYPE_PICTURE,
    TYPE_MOVEMENT_STATUS,
    TYPE_ROUTE_STATUS,
    TYPE_STATEVECT,
    TYPE_LOCALIZATION_RESULT,
    encodeBinaryMessage,
    decodeMessage
}
