import {IReactiveStoreChange, observePath, observerCallbackMap} from "../reactiveStore/reactiveStore";
import * as _ from "lodash";

export interface IObserveOpts<T=any> {
    callback?: (change: IReactiveStoreChange, item: T) => void
}

const addPropertyObservePath = function (target: Object, propertyKey: string, path: observePath, opts: IObserveOpts) {
    if (target) {
        let handler = observerCallbackMap.get(target);
        if (!handler) {
            handler = new Map();
            observerCallbackMap.set(target, handler);
        }

        let map = handler.get(propertyKey);
        if (!map) {
            map = [];
            handler.set(propertyKey, map);
        }

        map.push({path, opts});
    }
};


export const observe = function <T=any>(path: observePath, opts: IObserveOpts<T> = {}): PropertyDecorator {
    return function (target: Object, propertyKey: string) {
        addPropertyObservePath(target, propertyKey, path, opts);
    }
};

export const observeProperty = function <T=any>(path: observePath, opts: IObserveOpts<T> = {}): PropertyDecorator {
    return function (target: Object, propertyKey: string) {
        if (target) {

            const callback = opts.callback || (() => {
                console.log('?????????');
            });

            opts.callback = function (change) {
                const item = this[propertyKey];
                if (item) {
                    callback(change, item);
                }
            };

            addPropertyObservePath(target, propertyKey, path, opts);
        }

    }
};

