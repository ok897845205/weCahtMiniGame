// Learn TypeScript:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/typescript.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/manual/en/scripting/life-cycle-callbacks.html


import * as _ from 'lodash';
import {ReactiveStore} from "./reactiveStore/reactiveStore";
import Utils from "./utils/utils";
import Onion from "./onion/onion";

export class CoreHost {

    private injectMap: Map<string, { path: string, callback: () => any, order: number }> = new Map();
    private startedCallbacks: { callback: () => any, order: number }[] = [];

    private constructor(private key: string) {
        // this.hostCreator = coreHostCreator(key, this, this.injectMap, this.objectPathMap);
    }

    inject(path: string, callback: () => any, order: number = 0) {
        if (callback) {
            if (!this._started) {
                console.log(`${this.key} inject ${path} ...`);
                this.injectMap.set(path, {path, callback, order});
            }
            else {
                console.log(`${this.key} inject ${path}!`);
                _.set(this, path, callback());
            }
        }
    }

    private _started: boolean = false;

    started(callback: () => void, order: number = 0) {
        if (!this._started) {
            this.startedCallbacks.push({callback, order});
        }
    }

    start() {
        if (!this._started) {
            this._started = true;
            console.log(`${this.key} start!`);
            const values = _.sortBy(Array.from(this.injectMap.values()), 'sort');
            values.forEach((value) => {
                try {
                    const result = value.callback();
                    if (result !== undefined) {
                        _.set(this, value.path, result);
                    }
                }
                catch (err) {
                    console.log(`${this.key} inject ${value.path} error!`, err);
                }
            });

            const callbacks = _.sortBy(this.startedCallbacks, 'sort');
            this.startedCallbacks = [];
            callbacks.forEach(callback => {
                try {
                    callback.callback()
                }
                catch (err) {
                    console.log(`${this.key} callback error!`, err);
                }
            });
        }
    }

    static applyMixins(derivedCtor: any, baseCtors: any[]) {
        baseCtors.forEach(baseCtor => {
            Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
                derivedCtor.prototype[name] = baseCtor.prototype[name];
            });
        });
    }

    static create(key: string, ...mixins: (new () => any)[]): any {

        if (mixins && mixins.length) {
            class temp extends CoreHost {
                constructor(key: string) {
                    super(key);
                }
            }

            CoreHost.applyMixins(temp, mixins);
            const result = new temp(key);
            for (const mixin of mixins) {
                mixin.bind(result)();
            }
            return result;
        }
        return new CoreHost(key);
    }
}

if (typeof window !== 'undefined') {
    if (!window['__makeTemplateObject']) {
        window['__makeTemplateObject'] = function (cooked, raw) {
            if (Object.defineProperty) {
                Object.defineProperty(cooked, "raw", {value: raw});
            } else {
                cooked.raw = raw;
            }
            return cooked;
        };
    }
}

declare global {
    interface CoreModule extends CoreHost {

    }
}

const store = new ReactiveStore();

class Core {
    reactiveStore = store;
    readonly root = store.observable({});
    utils = new Utils();
}

export const core: CoreModule & Core & Onion = CoreHost.create('core', Core, Onion);

console.log('core inited!');