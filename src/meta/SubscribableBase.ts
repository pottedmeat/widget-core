import { includes } from '@dojo/shim/array';
import Map from '@dojo/shim/Map';
import { Subscription } from '@dojo/shim/Observable';
import { Base } from './Base';
import {
	WidgetMetaOptions,
	WidgetMetaSubscriptionMultiCallback,
	WidgetMetaSubscriptionSingleCallback
} from '../interfaces';
import { meta } from '../WidgetBase';

interface Callback<T> {
	callback?: WidgetMetaSubscriptionSingleCallback<T> | WidgetMetaSubscriptionMultiCallback<T>;
}

const log = false;

export abstract class SubscribableBase<T, O extends WidgetMetaOptions = WidgetMetaOptions> extends Base<T, O> {
	private _subscriptions = new Map<string, Callback<T>[]>();
	private _managed: { [key: string]: Subscription } = {};
	private _keys: string[] = [];

	protected abstract track(key: string, options?: any[]): void;

	protected abstract untrack(key: string, options?: any[]): void;

	protected invalidate(keys?: string[]): void {
		const {
			_subscriptions: subscriptions
		} = this;

		if (keys) {
			let caught = true;
			const values = new Map<string, T>();
			for (const key of keys) {
				if (this.has(key)) {
					const value: T = this.get(key);
					values.set(key, value);
					const callbacks = subscriptions.get(key);
					if (callbacks) {
						for (const callback of callbacks) {
							callback.callback && (<WidgetMetaSubscriptionSingleCallback<T>> callback.callback)(value);
						}
					}
					else {
						caught = false;
					}
				}
			}
			const callbacks = subscriptions.get(meta.ALL_KEYS);
			if (callbacks) {
				caught = true;
				if (keys.length) {
					for (const callback of callbacks) {
						callback.callback && (<WidgetMetaSubscriptionMultiCallback<T>> callback.callback)(values);
					}
				}
			}
			if (caught) {
				return;
			}
		}

		super.invalidate();
	}

	public onKeysUpdated(keys: string[]): void {
		const {
			_managed: managed,
			_subscriptions: subscriptions
		} = this;
		// use keys from the past render to subscribe to all keys we haven't already
		const subscription = subscriptions.get(meta.ALL_KEYS);
		if (subscription) {
			for (const key of keys) {
				if (!this._managed[key]) {
					this._managed[key] = this.subscribe(key);
				}
			}
		}
		for (const key of this._keys) {
			// Identify keys that have disappeared since the last render
			if (!includes(keys, key)) {
				if (managed[key]) {
					// Unsubscribe from subscriptions we manage
					managed[key].unsubscribe();
					delete managed[key];
				}
				if (!includes(this.requiredKeys, key)) {
					// Telling meta classes to stop tracking is useful
					// if they have to set up an event handler in their
					// get. This will only happen on a render where the
					// key does not appear.
					this.untrack(key);
				}
			}
		}
		this._keys = keys.slice();
	}

	public subscribe(key: string, callback?: WidgetMetaSubscriptionSingleCallback<T>, ...options: any[]): Subscription {
		const callbacks = this._subscriptions.get(key) || [];
		const callbackDetails = {
			callback
		};
		callbacks.push(callbackDetails);
		this._subscriptions.set(key, callbacks);
		if (callback && this.has(key)) {
			callback(this.get(key));
		}
		if (key !== meta.ALL_KEYS) {
			this.track(key, options);
		}
		log && console.log('subscribing to', key);
		const subscription = {
			closed: false,
			unsubscribe: () => {
				if (!subscription.closed) {
					subscription.closed = true;
					const callbacks = this._subscriptions.get(key);
					if (callbacks) {
						const index = callbacks.indexOf(callbackDetails);
						if (index > -1) {
							callbacks.splice(index, 1);
							if (callbacks.length === 0) {
								log && console.log('unsubscribing from', key);
								this._subscriptions.delete(key);
								this.untrack(key, options);
							}
						}
					}
				}
			}
		};
		return subscription;
	}
}

export default SubscribableBase;
