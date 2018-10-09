import {ReactiveStoreObserver, ReactiveStoreObserverHost} from "./reactiveStoreObserver";
import {ReactiveStoreDeliver} from "./reactiveStoreDeliver";
import * as _ from 'lodash';
import * as m from 'mingo';
import mingod from 'mingo';
import {core} from "../core";

let mingo = m.default;
mingo = <any>m;


export enum ReactiveStoreChangeType {
    Add = 'add',
    Update = 'update',
    Delete = 'delete',
    Refresh = 'refresh'
}

export type ReactiveStoreChangeCallback = (change: IReactiveStoreChange) => void

export interface IReactiveStoreChange {
    subject: Object,
    object?: Object,
    index: string | number | symbol,
    value: any,
    oldValue: any,
    type: ReactiveStoreChangeType,
    //depth?: number,
}

interface IReactiveStoreMeta {
    deliver: ReactiveStoreDeliver,
    children: Map<string | number | symbol, IReactiveStoreMeta>,
    index?: string;
    depth: number,
    readonly muteState: Set<any>
}

export interface IReactiveStoreUpdateArgs {
    //object
    $set?: { [path: string]: any },
    $unset?: { [path: string]: true },
    $merge?: { [path: string]: any },
    $rename?: { [path: string]: any },
    //math
    $inc?: { [path: string]: number },
    $max?: { [path: string]: number },
    $min?: { [path: string]: number },
    $mul?: { [path: string]: number },
    //array
    $push?: { [path: string]: any[] },
    $pop?: { [path: string]: number },
    $unshift?: { [path: string]: any[] },
    $shift?: { [path: string]: number },
    $splice?: { [path: string]: [number, number, any[]] }
    //mingo
    $remove?: { [path: string]: any },
    $aggregate?: { [path: string]: any[] },
}

// const ReactiveStoreParamsTag = Symbol('paramsTag');
// const ReactiveStoreParamsReg = /\(.+\)/;
const ReactiveStoreUpdateMuteChannelTag = Symbol('ReactiveStoreUpdateMuteChannelTag');

export type observePath = string | ((context: object) => string)

export const observerCallbackMap: WeakMap<object, Map<string, {
    path: observePath,
    opts?: any
}[]>> = new WeakMap();

export class ReactiveStore {

    objectToParent = new WeakMap();
    objectToMeta: WeakMap<any, IReactiveStoreMeta> = new WeakMap();
    metaToObject = new WeakMap();


    // private getObservableObjProxyHandler() {
    //     const self = this;
    //     return {
    //         get: function (target, property, receiver) {
    //             return self.getProxyObject(target[property]);
    //
    //             // const result = target[property];
    //             // if (result !== undefined) {
    //             //     //console.log(`get property:${property} value:${JSON.stringify(result)}`);
    //             //     const po = self.getProxyObject(result);
    //             //     if (po !== result) {
    //             //         //console.log(`get property:${property} Proxy!`);
    //             //         return po;
    //             //     }
    //             //     //console.log(`get property:${property} Raw!`);
    //             //     return result;
    //             // }
    //
    //             // if (typeof property !== 'symbol' && property !== 'inspect') {
    //             //     const meta = self.getMeta(target).children.get(property);
    //             //     const host = self.metaToProxy.get(meta);
    //             //     if (host) {
    //             //         //console.log(`get property:${property} host:${JSON.stringify(host)}`);
    //             //         return host;
    //             //     }
    //             //
    //             //     const empty = {};
    //             //     target = self.getRawObject(target);
    //             //     Reflect.set(target, property, empty);
    //             //     return self.observable(empty, {object: target, key: property});
    //             // }
    //             // else {
    //             //     return result;
    //             // }
    //         },
    //         set: function (target, property, value, receiver) {
    //             let oldValue = target[property];
    //             let type = (oldValue === undefined ? ReactiveStoreChangeType.Add : ReactiveStoreChangeType.Update);
    //
    //             //console.log(`set property:${property} value:${JSON.stringify(value)}`);
    //
    //             const rawValue = self.getRawObject(value);
    //             if (rawValue === value && typeof value === 'object' && value !== null) {
    //                 self.observable(value, {object: target, key: property});
    //             }
    //
    //             //设置值
    //             target[property] = rawValue;
    //
    //             self.processMetas(target, property, rawValue, value, oldValue, type);
    //             return true;
    //         },
    //         // deleteProperty: function (target, property) {
    //         //     let oldValue = target[property];
    //         //     delete target[property];
    //         //     self.processMetas(target, property, undefined, undefined, oldValue, ReactiveStoreChangeType.Delete);
    //         //     return true;
    //         // },
    //         // defineProperty: function (target, property, descriptor) {
    //         //     return true;
    //         // },
    //         // setPrototypeOf: function (target, prototype) {
    //         //     return true;
    //         // },
    //         // preventExtensions: function (target) {
    //         //     return true;
    //         // }
    //     }
    // }
    //
    // private getObservableArrayProxyHandler() {
    //     const self = this;
    //     return {
    //         get: function (target, property) {
    //             if (property === "splice") {
    //                 return function (start, end) {
    //                     if (typeof(start) !== "number" || typeof(end) !== "number") {
    //                         throw new TypeError("First two arguments to Array splice are not number, number");
    //                     }
    //
    //                     let changedValues: [ReactiveStoreChangeType, number, any, any][] = [];
    //                     let addedValues = arguments.length > 2 ? Array.prototype.slice.bind(arguments)(2, arguments.length) : [];
    //                     if (addedValues.length > 0) {
    //                         const newLength = target.length + addedValues.length;
    //                         let addedValueOffset = 0;
    //                         let newValue = addedValues[addedValueOffset];
    //                         for (let i = start; i < newLength; i++) {
    //                             const oldValue = target[i];
    //                             const type = oldValue === undefined ? ReactiveStoreChangeType.Add : ReactiveStoreChangeType.Update;
    //                             changedValues.push([type, i, oldValue, newValue]);
    //
    //                             newValue = ++addedValueOffset < addedValues.length ?
    //                                 addedValues[addedValueOffset] :
    //                                 target[start + addedValueOffset - addedValues.length];
    //                         }
    //                     }
    //
    //                     if (end) {
    //                         let removedValues = [];
    //                         for (let i = start; i < start + end; i++) {
    //                             removedValues.push(target[i]);
    //                         }
    //
    //                         if (removedValues.length > 0) {
    //                             let removedValueOffset = 0;
    //                             for (let i = start; i < target.length; i++) {
    //                                 const oldValue = removedValueOffset < removedValues.length ?
    //                                     removedValues[removedValueOffset] :
    //                                     target[i + removedValues.length - 1];
    //                                 const newValue = target[i + removedValues.length];
    //                                 removedValueOffset++;
    //
    //                                 if (oldValue === undefined && newValue === undefined) {
    //                                     continue;
    //                                 }
    //
    //                                 const type = newValue === undefined ? ReactiveStoreChangeType.Delete : ReactiveStoreChangeType.Update;
    //                                 changedValues.push([type, i, oldValue, newValue]);
    //                             }
    //                         }
    //
    //                         this.slice(start, start + end);
    //                     }
    //
    //                     target.splice.apply(target, arguments);
    //
    //                     for (let [type, index, oldValue, value] of changedValues) {
    //                         const property = index.toString();
    //                         const rawValue = self.getRawObject(value);
    //                         if (rawValue === value && typeof value === 'object' && value !== null) {
    //                             self.observable(value, {object: target, key: property});
    //                         }
    //
    //                         self.processMetas(target, property, rawValue, value, oldValue, type);
    //                     }
    //                 }
    //             }
    //             if (property === "push") {
    //                 return function (item) {
    //                     return this.splice(this.length, 0, item);
    //                 }
    //             }
    //             if (property === "pop") {
    //                 return function () {
    //                     return this.splice(this.length - 1, 1);
    //                 }
    //             }
    //             if (property === "unshift") {
    //                 return function (item) {
    //                     return this.splice(0, 0, item);
    //                 }
    //             }
    //             if (property === "shift") {
    //                 return function () {
    //                     return this.splice(0, 1);
    //                 }
    //             }
    //             return self.getProxyObject(target[property]);
    //         },
    //         set: function (target, property, value, receiver) {
    //             let oldValue = target[property];
    //             let type = (oldValue === undefined ? ReactiveStoreChangeType.Add : ReactiveStoreChangeType.Update);
    //
    //             //console.log(`set property:${property} value:${JSON.stringify(value)}`);
    //
    //             const rawValue = self.getRawObject(value);
    //             if (rawValue === value && typeof value === 'object' && value !== null) {
    //                 self.observable(value, {object: target, key: property});
    //             }
    //
    //             //设置值
    //             target[property] = rawValue;
    //
    //             self.processMetas(target, property, rawValue, value, oldValue, type);
    //             return true;
    //         },
    //         // deleteProperty: function (target, property) {
    //         //     let oldValue = target[property];
    //         //     delete target[property];
    //         //     self.processMetas(target, property, undefined, undefined, oldValue, ReactiveStoreChangeType.Delete);
    //         //     return true;
    //         // },
    //     }
    // }
    //
    observable<T extends object={}>(obj?: T, parent?: { object: Object, key: string | number | symbol }): T & { [p: string]: any } {

        obj = obj || {} as any;

        if (typeof obj === 'object' && !this.isObservable(obj)) {

            let meta: IReactiveStoreMeta;

            if (parent) {
                const parentMeta = this.getMeta(parent.object);
                if (parentMeta) {
                    meta = parentMeta.children.get(parent.key);
                    if (!meta) {
                        meta = {
                            index: parent.key.toString(),
                            deliver: new ReactiveStoreDeliver(parentMeta.deliver.parts.concat([parent.key.toString()])),
                            children: new Map(),
                            depth: parentMeta.depth + 1,
                            muteState: parentMeta.muteState
                        };
                        parentMeta.children.set(parent.key, meta);
                    }
                }
                this.objectToParent.set(obj, parent.object);
            }
            else {
                meta = {
                    deliver: new ReactiveStoreDeliver([]),
                    children: new Map(),
                    depth: 0,
                    muteState: new Set()
                };
            }

            this.metaToObject.set(meta, obj);
            this.objectToMeta.set(obj, meta);

            for (const key in obj) {
                let value = obj[key];
                this.observable(value, {object: obj, key});
            }

            return obj;

        }
        return obj;

    }

    isObservable(obj: any): boolean {
        return !!this.objectToMeta.get(obj);
    }

    private processOwnMeta(target, type: ReactiveStoreChangeType) {
        //处理当前meta下所有children
        const parent = this.objectToParent.get(target);
        const parentMeta = this.getMeta(parent);
        if (parentMeta) {
            const oldMeta = this.getMeta(target);
            const wildMeta = parentMeta.children.get('*');

            //同级与子级
            const trigger = (meta: IReactiveStoreMeta, rawValue, parts: string[] = [], depth: number = 0) => {
                if (depth > 0) {
                    meta.index && parts.push(meta.index === '*' ? oldMeta.index : meta.index);
                    if (meta.index !== '*') {
                        if (_.get(rawValue, meta.index) === undefined) {
                            this.metaToObject.delete(meta);
                        }
                    }
                }

                if (meta.deliver.hasObservers()) {
                    let change = {
                        index: oldMeta.index,
                        value: target,
                        oldValue: target,
                        type: type,
                        depth: oldMeta ? oldMeta.depth : 0
                    };

                    meta.deliver.updateChange(change, meta.muteState && meta.muteState.size > 0);
                }
                depth++;
                meta.children.forEach(next => trigger(next, _.get(rawValue, next.index), parts, depth));
            };
            oldMeta && trigger(oldMeta, target);
            wildMeta && trigger(wildMeta, target);
        }
    }

    private processMetas(target, property, value, oldValue, type: ReactiveStoreChangeType) {

        //处理当前meta下所有children
        const targetMeta = this.getMeta(target);
        const oldMeta = targetMeta.children.get(property);
        const wildMeta = targetMeta.children.get('*');
        // if(property === "nickName"){
        //     console.log('sk_DEBUG processMetas', type, targetMeta, oldMeta, wildMeta, target, property);
        // }
        //同级与子级
        const trigger = (meta: IReactiveStoreMeta, rawValue, parts: string[] = [], depth: number = 0) => {
            if (depth > 0) {
                meta.index && parts.push(meta.index === '*' ? property : meta.index);
                if (meta.index !== '*') {
                    if (_.get(rawValue, meta.index) === undefined) {
                        this.metaToObject.delete(meta);
                    }
                }
            }

            if (meta.deliver.hasObservers()) {
                let change = {
                    index: property,
                    value,
                    oldValue,
                    type: type,
                    depth: oldMeta ? oldMeta.depth : 0
                };
                // console.log('sk_DEBUG deliver', property, parts, change, meta);
                meta.deliver.updateChange(change, meta.muteState && meta.muteState.size > 0);
            }
            depth++;
            meta.children.forEach(next => trigger(next, _.get(rawValue, next.index), parts, depth));
        };
        oldMeta && trigger(oldMeta, value);
        wildMeta && trigger(wildMeta, value);
    }

    unset(obj: object, path: string | string[]) {
        const pathArray = core.utils.toPath(path);
        this.set(obj, pathArray);
        _.unset(obj, path);
    }

    get<T=any>(obj: object, path: string | string[], defaultValue?: T): T {
        return _.get(obj, path, defaultValue);
    }


    set(obj: object, path: string | string[], value?: any) {
        // console.log('set', obj, path, value);
        const pathArray = core.utils.toPath(path);
        if (pathArray.length > 1) {
            this.batch(obj, () => {
                this.deepSet(obj, pathArray, value);
            });

        }
        else {
            this.setCore(obj, _.last(pathArray), value);
        }
    }

    private deepSet(obj: any, pathArray: string[], value: any, offset: number = 0) {
        if (offset >= pathArray.length) {
            return;
        }

        if (_.isObject(obj)) {
            let property = pathArray[offset];
            let oldValue = obj[property];
            if (_.isObject(oldValue)) {
                if (offset === pathArray.length - 1) {
                    this.setCore(obj, property, value);
                }
                this.deepSet(oldValue, pathArray, value, offset + 1);
            }
            else {


                if (offset === pathArray.length - 1) {
                    this.setCore(obj, property, value);
                }
                else {
                    let index = parseInt(pathArray[offset + 1]);
                    if (!isNaN(index)) {
                        oldValue = [];
                    }
                    else {
                        oldValue = {};
                    }
                    this.setCore(obj, property, oldValue);
                }
                this.deepSet(oldValue, pathArray, value, offset + 1);
            }
        }
    }

    private setCore(obj: object, property: string, value?: any) {
        const oldValue = obj[property];
        let type = (oldValue === undefined ? ReactiveStoreChangeType.Add : ReactiveStoreChangeType.Update);
        if (typeof value === 'object' && value !== null) {
            this.observable(value, {object: obj, key: property});
        }
        //设置值
        obj[property] = value;
        this.processMetas(obj, property, value, oldValue, type);
        return oldValue;
    }

    merge(obj: object, ...values: object[]) {
        if (obj === undefined) {
            obj = {};
        }
        this.observable(obj);
        values.forEach((value) => {
            this.mergeCore(obj, value);
        });
        return obj;
    }

    mergeCore(obj: object, value: object, changes?: object) {
        for (let key in value) {
            let subValue = value[key];
            let subObj = obj[key];

            if (subValue !== undefined) {
                this.observable(subValue, {object: obj, key});
            }

            if (!subObj || !_.isObject(subObj) || !_.isObject(subValue)) {
                let oldValue = this.setCore(obj, key, subValue);
                changes = _.set(changes || {}, key, oldValue);
                continue;
            }

            if (_.isObject(subValue)) {
                let type = (subObj === undefined ? ReactiveStoreChangeType.Add : ReactiveStoreChangeType.Update);
                const oldChanges = this.mergeCore(subObj, subValue);
                // console.log(oldChanges);
                this.processMetas(obj, key, subValue, oldChanges, type);
                if (oldChanges) {
                    changes = _.set(changes || {}, key, oldChanges);
                }

            }
        }

        return changes;
    }

    remove<T=any>(obj: T[], predicate: (item: T, index?: number) => any): T[] {
        if (_.isArray(obj)) {
            // this.setMute(obj);
            const removesIndex = [];
            const removes = [];
            for (let i = 0; i < obj.length; i++) {
                if (predicate(obj[i], i)) {
                    removesIndex.push(i);
                }
            }

            while (removesIndex.length > 0) {
                const i = removesIndex.pop();
                removes.unshift(obj[i]);
                this.splice(obj, i, 1);
            }
            if (removes.length > 0) {
                this.processOwnMeta(obj, ReactiveStoreChangeType.Update);
            }
            return removes;
        }
        return [];
    }

    splice(array: any[], start: number, end: number, ...values: any[]) {
        if (typeof(start) !== "number" || typeof(end) !== "number") {
            throw new TypeError("First two arguments to Array splice are not number, number");
        }

        let changedValues: [ReactiveStoreChangeType, number, any, any][] = [];
        let addedValues = arguments.length > 3 ? Array.prototype.slice.bind(arguments)(3, arguments.length) : [];
        if (addedValues.length > 0) {
            const newLength = array.length + addedValues.length;
            let addedValueOffset = 0;
            let newValue = addedValues[addedValueOffset];
            for (let i = start; i < newLength; i++) {
                const oldValue = array[i];
                const type = oldValue === undefined ? ReactiveStoreChangeType.Add : ReactiveStoreChangeType.Update;
                changedValues.push([type, i, oldValue, newValue]);

                newValue = ++addedValueOffset < addedValues.length ?
                    addedValues[addedValueOffset] :
                    array[start + addedValueOffset - addedValues.length];
            }
        }

        if (end) {
            let removedValues = [];
            for (let i = start; i < start + end; i++) {
                removedValues.push(array[i]);
            }

            if (removedValues.length > 0) {
                let removedValueOffset = 0;
                for (let i = start; i < array.length; i++) {
                    const oldValue = removedValueOffset < removedValues.length ?
                        removedValues[removedValueOffset] :
                        array[i + removedValues.length - 1];
                    const newValue = array[i + removedValues.length];
                    removedValueOffset++;

                    if (oldValue === undefined && newValue === undefined) {
                        continue;
                    }

                    const type = newValue === undefined ? ReactiveStoreChangeType.Delete : ReactiveStoreChangeType.Update;
                    changedValues.push([type, i, oldValue, newValue]);
                }
            }

            array.slice(start, start + end);
        }

        array.splice.call(array, start, end, ...values);

        for (let [type, index, oldValue, value] of changedValues) {
            const property = index.toString();

            if (typeof value === 'object' && value !== null) {
                this.observable(value, {object: array, key: property});
            }

            this.processMetas(array, property, value, oldValue, type,);
        }
    }

    push(array: any[], value: any) {
        return this.splice(array, array.length, 0, value);
    }

    pop(array: any[]) {
        return this.splice(array, array.length - 1, 1);
    }

    unshift(array: any[], value: any) {
        return this.splice(array, 0, 0, value);
    }

    shift(array: any[]) {
        return this.splice(array, 0, 1);
    }


    createObserver(obj: any, relativePath?: string): ReactiveStoreObserver {
        return new ReactiveStoreObserver(obj, relativePath);
    }

    toObserverCallback(callback: ReactiveStoreChangeCallback): ReactiveStoreChangeCallback {
        return callback;
    }

    // createUpdater(obj, path?) {
    //     return new ReactiveStoreObserver(obj, path);
    // }

    cleanObject(obj: object) {
        const meta = this.getMeta(obj);

        this.objectToParent.delete(obj);
        this.objectToMeta.delete(obj);
        this.metaToObject.delete(meta);
    }

    getPathParts(obj: object): string[] {
        const parts = [];
        while (obj) {
            let meta = this.objectToMeta.get(obj);
            meta && meta.index && parts.unshift(meta.index);
            obj = this.objectToParent.get(obj);
        }
        return parts;
    }

    private getMeta(obj: object): IReactiveStoreMeta {
        return this.objectToMeta.get(obj);
    }

    private ensureMeta(obj: object, parts: string[]) {
        let meta = this.getMeta(obj);

        if (!meta) {
            meta = {
                deliver: new ReactiveStoreDeliver([]),
                children: new Map(),
                depth: 0,
                muteState: new Set()
            };
        }


        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            if (part === '*' && i != parts.length - 1) {
                throw Error('\'*\' 通配符只能出现在路径末尾。');
            }
            let nextMeta = meta.children.get(part);
            if (!nextMeta) {
                nextMeta = {
                    index: part,
                    deliver: new ReactiveStoreDeliver(meta.deliver.parts.concat([part])),
                    children: new Map(),
                    depth: meta.depth + 1,
                    muteState: meta.muteState
                };
                meta.children.set(part, nextMeta);
            }
            meta = nextMeta;
        }

        return meta;
    }


    addListener(obj, parts: string[], callback: ReactiveStoreChangeCallback | ReactiveStoreObserverHost) {
        const meta = this.ensureMeta(obj, parts);
        if (meta) {
            meta.deliver.addListener(callback);
        }
    }

    removeListener(obj, parts: string[], callbacks: (ReactiveStoreChangeCallback | ReactiveStoreObserverHost) []): boolean {
        const meta = this.ensureMeta(obj, parts);
        if (meta) {
            meta.deliver.removeListener(callbacks);
            return true;
        }

        return false;
    }

    setMute(obj: any, mute: boolean, channel: any = '*') {
        const meta = this.getMeta(obj);
        if (meta) {
            if (mute) {
                meta.muteState.add(channel);
            }
            else {
                meta.muteState.delete(channel);
            }

            if (meta.muteState.size == 0) {
                const flushAll = function (meta: IReactiveStoreMeta) {
                    if (meta) {
                        meta.deliver.flushAllChanges();
                        if (meta.children) {
                            meta.children.forEach(next => flushAll(next));
                        }
                    }
                };
                flushAll(meta);
            }
        }
    }

    isMute(obj: any): boolean {
        const meta = this.getMeta(obj);
        if (meta) {
            return !!(meta.muteState && meta.muteState.size > 0);
        }
    }

    private batchMuteTag = Symbol('batchMuteTag');

    batch(obj: any, callback: (obj: any) => void) {
        if (callback) {
            this.setMute(obj, true, this.batchMuteTag);
            callback(obj);
            this.setMute(obj, false, this.batchMuteTag);
        }
    }


    createQuery(criteria: any, projection?: any): mingod.Query {
        return new mingo.Query(criteria, projection);
    }

    find(obj: any, path: string, criteria: any, projection?: any): mingod.Cursor<any> {
        let instance = path ? _.get(obj, path) : obj;
        if (instance != undefined && criteria) {
            return this.createQuery(criteria, projection).find(instance);
        }
    }

    aggregate(obj: any, path: string, pipeline: any[]) {
        let instance = path ? _.get(obj, path) : obj;
        if (instance != undefined && pipeline) {
            return new mingo.Aggregator(pipeline).run(instance, null);
        }
    }

    update(obj: any, args: IReactiveStoreUpdateArgs, opts: { immediately?: true } = {}) {

        const {immediately} = opts;
        if (!immediately) {
            this.setMute(obj, true, ReactiveStoreUpdateMuteChannelTag);
        }

        if (args.$set) {
            for (const key in args.$set) {
                if (args.$set.hasOwnProperty(key)) {
                    const value = args.$set[key];
                    this.set(obj, key, value);
                }
            }
        }

        if (args.$merge) {
            for (const key in args.$merge) {
                if (args.$merge.hasOwnProperty(key)) {
                    const value = args.$merge[key];
                    const oldValue = _.get(obj, key, {});
                    // this.set(obj, key, this.merge(  this.observable({}), oldValue, value));
                    this.set(obj, key, this.merge(oldValue, value));
                }
            }
        }

        if (args.$unset) {
            for (const key in args.$unset) {
                if (args.$unset.hasOwnProperty(key)) {
                    this.unset(obj, key);
                }
            }
        }

        if (args.$rename) {
            for (const key in args.$rename) {
                if (args.$rename.hasOwnProperty(key)) {
                    const newName = args.$rename[key];
                    if (newName) {
                        const value = _.get(obj, key);
                        this.unset(obj, key);
                        this.set(obj, newName, value);
                    }
                }
            }
        }

        if (args.$inc) {
            for (const key in args.$inc) {
                if (args.$inc.hasOwnProperty(key)) {
                    const value = args.$inc[key];
                    if (_.isNumber(value)) {
                        const oldValue = _.get(obj, key);
                        if (oldValue === undefined) {
                            this.set(obj, key, value);
                        }
                        else if (_.isNumber(oldValue)) {
                            this.set(obj, key, oldValue + value);
                        }
                    }
                }
            }
        }

        if (args.$mul) {
            for (const key in args.$mul) {
                if (args.$mul.hasOwnProperty(key)) {
                    const value = args.$mul[key];
                    if (_.isNumber(value)) {
                        const oldValue = _.get(obj, key);
                        if (oldValue === undefined) {
                            this.set(obj, key, 0);
                        }
                        else if (_.isNumber(oldValue)) {
                            this.set(obj, key, oldValue * value);
                        }
                    }
                }
            }
        }

        if (args.$max) {
            for (const key in args.$max) {
                if (args.$max.hasOwnProperty(key)) {
                    const value = args.$max[key];
                    if (_.isNumber(value)) {
                        const oldValue = _.get(obj, key);
                        if (oldValue === undefined) {
                            this.set(obj, key, Math.max(0, value));
                        }
                        else if (_.isNumber(oldValue)) {
                            this.set(obj, key, Math.max(oldValue, value));
                        }
                    }
                }
            }
        }

        if (args.$min) {
            for (const key in args.$min) {
                if (args.$min.hasOwnProperty(key)) {
                    const value = args.$min[key];
                    if (_.isNumber(value)) {
                        const oldValue = _.get(obj, key);
                        if (oldValue === undefined) {
                            this.set(obj, key, Math.min(0, value));
                        }
                        else if (_.isNumber(oldValue)) {
                            this.set(obj, key, Math.min(oldValue, value));
                        }
                    }
                }
            }
        }

        if (args.$push) {
            for (const key in args.$push) {
                if (args.$push.hasOwnProperty(key)) {
                    let instance = _.get(obj, key);
                    if (instance === undefined) {
                        this.set(obj, key, []);
                        instance = _.get(obj, key);
                    }

                    if (instance instanceof Array) {
                        const values = args.$push[key];
                        values && values.forEach(value => this.push(instance, value));
                    }
                }
            }
        }

        if (args.$unshift) {
            for (const key in args.$unshift) {
                if (args.$unshift.hasOwnProperty(key)) {
                    let instance = _.get(obj, key);
                    if (instance === undefined) {
                        this.set(obj, key, []);
                        instance = _.get(obj, key);
                    }
                    if (instance instanceof Array) {
                        const values = args.$unshift[key];
                        values && values.forEach(value => this.unshift(instance, value));
                    }
                }
            }
        }

        if (args.$pop) {
            for (const key in args.$pop) {
                if (args.$pop.hasOwnProperty(key)) {
                    const instance = _.get(obj, key);
                    if (instance != undefined && instance instanceof Array) {
                        const times = args.$pop[key];
                        times && _.times(times, () => this.pop(instance));
                    }
                }
            }
        }

        if (args.$shift) {
            for (const key in args.$shift) {
                if (args.$shift.hasOwnProperty(key)) {
                    const instance = _.get(obj, key);
                    if (instance != undefined && instance instanceof Array) {
                        const times = args.$shift[key];
                        times && _.times(times, () => this.shift(instance));
                    }
                }
            }
        }

        if (args.$splice) {
            for (const key in args.$splice) {
                if (args.$splice.hasOwnProperty(key)) {
                    let instance = _.get(obj, key);
                    if (instance === undefined) {
                        this.set(obj, key, []);
                        instance = _.get(obj, key);
                    }

                    if (instance instanceof Array) {
                        const values = args.$splice[key];
                        if (values) {
                            const [index = 0, howmany = 0, items] = values;
                            if (items && items instanceof Array) {
                                this.splice(instance, index, howmany, ...items);
                            }
                            else {
                                this.splice(instance, index, howmany);
                            }
                        }

                    }
                }
            }
        }

        if (args.$remove) {
            for (const key in args.$remove) {
                if (args.$remove.hasOwnProperty(key)) {
                    let instance = _.get(obj, key);
                    if (instance != undefined && instance instanceof Array) {
                        const criteria = args.$remove[key];
                        if (criteria) {
                            instance = mingo.remove(instance, criteria);
                            this.set(obj, key, instance);
                        }
                    }
                }
            }
        }


        if (args.$aggregate) {
            for (const key in args.$aggregate) {
                if (args.$aggregate.hasOwnProperty(key)) {
                    let instance = _.get(obj, key);
                    if (instance != undefined) {
                        const pipeline = args.$aggregate[key];
                        if (pipeline) {
                            const agg = new mingo.Aggregator(pipeline);
                            if (instance instanceof Array) {
                                instance = agg.run(instance, null);
                                this.set(obj, key, instance);
                            } else if (_.isObject(instance)) {
                                instance = agg.run([instance], null);
                                this.set(obj, key, instance[0]);
                            }
                        }
                    }
                }
            }
        }

        if (!immediately) {
            this.setMute(obj, false, ReactiveStoreUpdateMuteChannelTag);
        }
    }
}


// declare global {
//     interface CoreModule {
//         reactiveStore: ReactiveStore;
//     }
// }


// core.inject('reactiveStore', ()=>new ReactiveStore());