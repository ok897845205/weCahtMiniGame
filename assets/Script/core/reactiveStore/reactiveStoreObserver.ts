import * as _ from "lodash";
import {
    IReactiveStoreChange, observerCallbackMap, ReactiveStoreChangeCallback, ReactiveStoreChangeType
} from "./reactiveStore";
import {core} from "../core";


export class ReactiveStoreObserverHost {
    private readonly rawCallback: ReactiveStoreChangeCallback;
    private callback: ReactiveStoreChangeCallback;
    private changes: IReactiveStoreChange[];
    private muteState: Set<any>;
    private readonly index: string;
    public readonly wild: boolean = false;
    public readonly parentParts: string[];

    constructor(public observer: ReactiveStoreObserver, parts: string[], public readonly path: string, callback: ReactiveStoreChangeCallback) {
        this.rawCallback = callback;
        this.callback = this.rawCallback;
        parts = Array.from(parts);
        if (_.last(parts) === '*') {
            this.wild = true;
            parts.pop();
        }
        this.index = parts.pop();
        this.parentParts = parts;
    }

    private _binder;
    get binder(): any {
        return this._binder;
    }

    bind(target: object): this {
        if (this.rawCallback) {
            this.callback = this.rawCallback.bind(target);
            this._binder = target;
            this.observer.mapBinder(this, target);
        }
        return this;
    }

    private ignore: boolean = false;

    refresh(): this {
        const parent = _.get(this.observer.subject, this.parentParts);
        const value = _.get(parent, this.index);
        if (!this.wild) {
            this.updateChange({
                subject: this.observer.subject,
                object: parent,
                index: this.index,
                oldValue: value,
                value,
                type: ReactiveStoreChangeType.Refresh
            });
        }
        else {
            if (value !== undefined) {
                if (_.isObject(value)) {
                    if (!_.isArray(value)) {
                        for (const key in value) {
                            if (value.hasOwnProperty(key)) {
                                const v = value[key];
                                this.updateChange({
                                    subject: this.observer.subject,
                                    object: value,
                                    index: key,
                                    oldValue: v,
                                    value: v,
                                    type: ReactiveStoreChangeType.Refresh
                                });
                            }
                        }
                    }
                    else {
                        for (let i = 0; i < value.length; i++) {
                            const v = value[i];
                            this.updateChange({
                                subject: this.observer.subject,
                                object: value,
                                index: i.toString(),
                                oldValue: v,
                                value: v,
                                type: ReactiveStoreChangeType.Refresh
                            });
                        }
                    }
                }
            }
        }
        return this;
    }

    ignorePreviousChanges(ignore: boolean): this {
        this.ignore = ignore;
        return this;
    }

    setMute(mute: boolean, channel: any = '*'): this {
        if (mute) {
            if (!this.muteState) {
                this.muteState = new Set();
            }
            this.muteState.add(channel);
        }
        else {
            if (this.muteState) {
                this.muteState.delete(channel);

                if (this.muteState.size == 0) {
                    this.flushAllChanges();
                }
            }
        }

        return this;
    }

    isMute(): boolean {
        return !!(this.muteState && this.muteState.size > 0);
    }

    updateChange(change: IReactiveStoreChange) {
        // console.log(change);
        // console.log('===================================');
        if (!this.observer.isMute() && !this.isMute()) {
            this.callback({subject: this.observer.subject, ...change});
        }
        else {
            if (!this.changes) {
                this.changes = [change];
            }
            else {
                this.changes.push(change);
            }
        }
    }

    flushAllChanges() {
        if (!this.ignore) {
            this.changes && this.changes.forEach(change => this.callback(change));
        }
        else {
            this.changes && this.callback(_.last(this.changes));
        }
    }
}

export class ReactiveStoreObserver {
    private _subject: object;
    get subject() {
        return this._subject;
    };

    private subjectParts: string[] = [];
    private relativeParts: string[];
    private muteState: Set<any>;

    private setSubject(subject) {
        this._subject = subject;
        this.subjectParts = core.reactiveStore.getPathParts(subject);
        if (this.relativeParts && this.relativeParts.length) {
            this.subjectParts = this.subjectParts.concat(this.relativeParts);
        }
    }

    // observePathMap: IReactiveStoreObserverPathMap = {children: new Map()};
    private callbacksMap = new Map<string, {
        hosts: Set<ReactiveStoreObserverHost>,
        callbackToHost: WeakMap<any, any>,
        changes: any[],
    }>();
    private binderToHosts: WeakMap<object, Set<ReactiveStoreObserverHost>> = new WeakMap();


    constructor(subject: object, relativePath?: string) {
        if (subject /* && core.reactiveStore.isObservable(subject)*/) {
            this.relativeParts = core.utils.toPath(relativePath);
            this.setSubject(subject);
            // this.observePathMap.index = core.reactiveStore.getObservableObjectIndex(subject);
        }
    }

    observePath(path: string | string[], callback: ReactiveStoreChangeCallback): ReactiveStoreObserverHost {
        if (this.subject && callback) {
            let parts = core.utils.toPath(path);

            if (this.relativeParts && this.relativeParts.length > 0) {
                parts = this.relativeParts.concat(parts);
            }

            const finalPath = parts.join('.');
            // let realPath = finalPath;
            // if (wild) {
            //     wild && parts.pop();
            //     realPath = parts.join('.');
            // }
            //console.warn("observer instance", finalPath);
            let callbacks = this.callbacksMap.get(finalPath);
            if (!callbacks) {
                callbacks = {hosts: new Set(), callbackToHost: new WeakMap<any, any>(), changes: []};
                this.callbacksMap.set(finalPath, callbacks);
            }

            const host = new ReactiveStoreObserverHost(this, parts, finalPath, callback);

            callbacks.hosts.add(host);
            callbacks.callbackToHost.set(callback, host);
            core.reactiveStore.addListener(this.subject, parts, host);

            return host;
        }
    }

    releasePath(path: string | string[], callback?: ReactiveStoreChangeCallback | ReactiveStoreObserverHost) {
        let parts = core.utils.toPath(path);

        // if (this.relativeParts && this.relativeParts.length > 0) {
        //     parts = this.relativeParts.concat(parts);
        // }
        //
        path = parts.join('.');

        const callbacks = this.callbacksMap.get(path);
        if (callbacks) {
            if (callback) {
                let host = callbacks.callbackToHost.get(callback);
                if (!host && callback instanceof ReactiveStoreObserverHost) {
                    host = callback;
                }
                if (host) {
                    callbacks.hosts.delete(host);
                    callbacks.callbackToHost.delete(callback);
                    core.reactiveStore.removeListener(this.subject, parts, [host]);
                }
            }
            else {
                core.reactiveStore.removeListener(this.subject, parts, Array.from(callbacks.hosts));
                callbacks.hosts.clear();
            }
        }
    }


    observeInstance(instance: object, context?: object): ReactiveStoreObserverHost[] {
        let hosts = [];
        if (instance) {
            for (const proto of [instance['__proto__'], instance['prototype']]) {
                if (proto) {
                    const callback = observerCallbackMap.get(proto);
                    if (callback) {
                        callback.forEach((defs, key) => {
                            if (defs) {
                                defs.forEach((def) => {
                                    if (def.path) {
                                        const fn = _.get(def, 'opts.callback') || proto[key] || instance[key];
                                        if (_.isFunction(fn)) {
                                            // if (_.isFunction(def.path)) {
                                            //     console.log(def.path);
                                            // }
                                            const path = _.isFunction(def.path) ? def.path(context) : def.path;
                                            let parts = path ? core.utils.toPath(path) : key;
                                            // if (this.relativeParts && this.relativeParts.length > 0) {
                                            //     parts = this.relativeParts.concat(def.parts);
                                            // }
                                            hosts.push(this.observePath(parts, fn).bind(instance));
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
            }
        }
        return hosts;
    }

    private batchMuteTag = Symbol('batchMuteTag');

    batch(callback: (obj: any) => void) {
        if (callback) {
            this.setMute(true, this.batchMuteTag);
            callback(this.subject);
            this.setMute(false, this.batchMuteTag);
        }
    }

    mapBinder(host, binder) {
        const hosts = this.binderToHosts.get(binder);
        if (!hosts) {
            this.binderToHosts.set(binder, new Set([host]));
            return;
        }
        hosts.add(host);
    }

    releaseAll(binder?) {
        if (arguments.length == 0) {
            this.callbacksMap.forEach((callbacks, path) => {
                if (callbacks.hosts.size > 0) {
                    const parts = core.utils.toPath(path);
                    core.reactiveStore.removeListener(this.subject, parts, Array.from(callbacks.hosts));
                }
            });
            this.callbacksMap = new Map();
        }
        else {
            const hosts = this.binderToHosts.get(binder);
            hosts && hosts.forEach((host) => {
                this.releasePath(host.path, host);
            });
        }
    }

    refreshAll(binder?) {
        if (arguments.length == 0) {
            this.callbacksMap.forEach((callbacks, path) => {
                callbacks.hosts && callbacks.hosts.forEach(host => host.refresh());
            });
        }
        else {
            const hosts = this.binderToHosts.get(binder);
            hosts && hosts.forEach(host => host.refresh());
        }
    }

    refreshPath(path: string | string[]) {
        let parts = core.utils.toPath(path);
        if (this.relativeParts && this.relativeParts.length > 0) {
            parts = this.relativeParts.concat(parts);
        }

        path = parts.join('.');

        const callbacks = this.callbacksMap.get(path);
        if (callbacks) {
            console.log("sk_DEBUG refreshPath", path, callbacks);
            callbacks.hosts && callbacks.hosts.forEach(host => host.refresh());
        }
    }


    setMute(mute: boolean, channel: any = '*') {

        if (mute) {
            if (!this.muteState) {
                this.muteState = new Set();
            }
            this.muteState.add(channel);
        }
        else {
            if (this.muteState) {
                this.muteState.delete(channel);
                if (this.muteState.size == 0) {
                    this.flushAllChanges();
                }
            }
        }
    }

    isMute(): boolean {
        return !!(this.muteState && this.muteState.size > 0);
    }

    flushAllChanges() {
        this.callbacksMap.forEach((callbacks, path) => {
            if (callbacks && callbacks.hosts.size > 0) {
                callbacks.hosts.forEach((host) => {
                    host.flushAllChanges();
                });
            }
        });
    }
}