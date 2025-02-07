/**
 *
 * PulseAdapter - an adapter for controlling Pulse pins.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const {Adapter, Database, Device, Event, Property} = require('gateway-addon');
const manifest = require('./manifest.json');

var timer = null;

class PulseProperty extends Property {
  constructor(device, name, propertyDescr) {
    super(device, name, propertyDescr);
    this.value = !!this.device.pulseConfig.invert;
  }

  /**
   * @method setValue
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve, _reject) => {
      let testCurrValue = this.value;
      let testNewValue = value;
      if (this.device.pulseConfig.invert) {
        testCurrValue = !testCurrValue;
        testNewValue = !testNewValue;
      }

      this.setCachedValue(value);
      console.log('Pulse:', this.device.name, 'set to:', this.value);
      resolve(this.value);
      this.device.notifyPropertyChanged(this);
      this.device.notifyEvent(this);
      
      if ((this.device.pulseConfig.replay || 
            (value === false || (this.device.pulseConfig.invert && !value)))
               && timer != null) {
        console.log('Clearing the existing timer')
        clearTimeout(timer);
      }

      // Only set the timeout if the incoming value is On or it is inverted
      if (value || (this.device.pulseConfig.invert && !value)) {
        console.log('Setting the timer')
        timer = setTimeout(() => {
          this.setCachedValue(!value);
          console.log('Pulse:', this.device.name, 'set to:', this.value);
          this.device.notifyPropertyChanged(this);
          this.device.notifyEvent(this);
        }, this.device.pulseConfig.duration * 1000);
      }
    });
  }
}

class PulseDevice extends Device {
  constructor(adapter, pulseConfig) {
    const id = `pulse-${pulseConfig.name}`;
    super(adapter, id);

    this.pulseConfig = pulseConfig;
    this.name = pulseConfig.name;

    console.log('Pulse:', this.pulseConfig);

    this.initOnOffSwitch();
    this.adapter.handleDeviceAdded(this);
  }

  asDict() {
    const dict = super.asDict();
    dict.pinConfig = this.pinConfig;
    return dict;
  }

  initOnOffSwitch() {
    this['@type'] = ['OnOffSwitch'];
    this.properties.set(
      'on',
      new PulseProperty(
        this,
        'on',
        {
          '@type': 'OnOffProperty',
          label: 'On/Off',
          type: 'boolean',
        }));
    this.addEvent('turnedOn', {
      '@type': 'TurnedOnEvent',
      description: 'Pulse transitioned from off to on',
    });
    this.addEvent('turnedOff', {
      '@type': 'TurnedOffEvent',
      description: 'Pulse transitioned from on to off',
    });
  }

  notifyEvent(property) {
    const eventName = property.value ? 'turnedOn' : 'turnedOff';
    console.log(this.name, 'event:', eventName);
    this.eventNotify(new Event(this, eventName));
  }
}

class PulseAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, manifest.id, manifest.id);
    addonManager.addAdapter(this);

    const db = new Database(manifest.id);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      for (const pulseConfig of config.pulses) {
        new PulseDevice(this, pulseConfig);
      }
    }).catch(console.error);
  }

  unload() {
    for (const deviceId in this.devices) {
      const device = this.devices[deviceId];
      this.handleDeviceRemoved(device);
    }
    return Promise.resolve();
  }
}

function loadPulseAdapter(addonManager) {
  new PulseAdapter(addonManager);
}

module.exports = loadPulseAdapter;
