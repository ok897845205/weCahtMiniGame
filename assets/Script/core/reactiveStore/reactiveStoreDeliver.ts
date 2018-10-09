import {IReactiveStoreChange, ReactiveStoreChangeCallback, ReactiveStoreChangeType} from "./reactiveStore";
import * as _ from "lodash";
import {ReactiveStoreObserverHost} from "./reactiveStoreObserver";

export class ReactiveStoreDeliver {
    changes: IReactiveStoreChange[] = [];
    observers: Set<any>;
    parts: string[];

    constructor(parts) {
        this.parts = parts;
    }

    addListener(callback: ReactiveStoreObserverHost | ReactiveStoreChangeCallback) {
        if (!this.observers) {
            this.observers = new Set([callback]);
        }
        else {
            this.observers.add(callback);
        }
    }

    removeListener(callbacks: (ReactiveStoreChangeCallback | ReactiveStoreObserverHost)[]): boolean {
        if (this.observers) {
            for (const callback of callbacks) {
                this.observers.delete(callback);
            }
            return true;
        }
        return false;
    }

    hasObservers() {
        return this.observers && this.observers.size > 0;
    }

    updateChange(change, mute) {
        // this.changes.push(change);
        // console.log(change);
        // console.log('==========================================');
        let {depth, value, oldValue, type, index} = change;

        (depth < 0) && (depth = 0);
        for (let i = depth; i < this.parts.length; i++) {

            index = this.parts[i];
            value = _.get(value, index);
            oldValue = _.get(oldValue, index);

            if (value === undefined && oldValue === undefined) {
                return;
            }

            if(value === oldValue){
                return;
            }
        }

        change = {
            index,
            oldValue,
            value,
            type: value === undefined ? ReactiveStoreChangeType.Delete : type
        };

        if (mute) {
            this.changes.push(change);
        }
        else {
            this.observers.forEach(observer => {
                if (observer) {
                    if (observer.updateChange) {
                        observer.updateChange(change)
                    }
                    else {
                        observer(change)
                    }
                }
            });
        }
    }

    flushAllChanges() {
        if (this.changes.length > 0) {
            const changes = this.changes;
            this.changes = [];
            if (this.hasObservers()) {
                changes.forEach(change => {
                    this.observers.forEach(observer => {
                        if (observer) {
                            if (observer.updateChange) {
                                observer.updateChange(change)
                            }
                            else {
                                observer(change)
                            }
                        }
                    });
                });
            }
        }
    }
}