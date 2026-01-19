#!/usr/bin/env node
/**
 * Serial Port Sniffer - View raw Arduino serial output
 * Usage: node serial-sniffer.js [PORT]
 *   PORT defaults to COM3, or set via SERIAL_PORT env var
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const port_name = process.argv[2] || process.env.SERIAL_PORT || 'COM3';

(async () => {
  try {
    const ports = await SerialPort.list();
    console.log('Available ports:', ports.map(p => p.path || p.comName).join(', '));

    const port = new SerialPort({ 
      path: port_name, 
      baudRate: 9600, 
      autoOpen: true 
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => {
      console.log(`\nSerial port ${port_name} opened at 9600 baud`);
      console.log('Listening for data... (Ctrl+C to stop)\n');
    });

    parser.on('data', (line) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${line}`);
    });

    port.on('error', (err) => {
      console.error('Serial port error:', err && err.message ? err.message : err);
    });

    port.on('close', () => {
      console.log('\nSerial port closed');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('\nClosing serial port...');
      port.close();
    });

  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
