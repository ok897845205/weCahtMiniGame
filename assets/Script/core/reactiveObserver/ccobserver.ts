// import {core} from "../core";
// import {ReactiveStoreObserver} from "../reactiveStore/reactiveStoreObserver";
// import * as _ from "lodash";
// import {IReactiveStoreChange, observePath} from "../reactiveStore/reactiveStore";
// import {observeProperty} from "./observer";

// const boxing = function (proto, funcName, func) {
//     const old = proto[funcName];
//     if (old) {
//         proto[funcName] = function () {
//             old.call(this, ...arguments as any);
//             func.call(this, ...arguments as any);
//         }
//     }
//     else {
//         proto[funcName] = func;
//     }
// };

// const getInstanceMeta = function (obj: object) {
//     const meta = obj && obj.constructor && obj.constructor[ccComponentObserverConstructorMetaTag];
//     if (meta) {
//         let instanceMeta = obj[ccComponentObserverInstanceMetaTag];
//         if (!instanceMeta) {
//             instanceMeta = {root: meta.root, opts: _.cloneDeep(meta.opts)};
//             obj[ccComponentObserverInstanceMetaTag] = instanceMeta;
//         }
//         return instanceMeta;
//     }
// };

// const ccComponentObserverConstructorMetaTag = Symbol('ccComponentObserverConstructorMetaTag');
// const ccComponentObserverInstanceMetaTag = Symbol('ccComponentObserverInstanceMetaTag');

// export interface IccComponentObserverOpts {
//     relativePath?: string,
//     noAutoBinding?: boolean,
//     handleEnableDisable?: boolean,
//     noRefresh?: boolean,
//     observeContextGetter?: ((instance?: object) => object) | object
// }


// export const ccComponentObserver: ((root?: any, opts?: IccComponentObserverOpts) => Function) & {
//     setSubject: (obj: cc.Component, root?: any, opts?: IccComponentObserverOpts) => void,
//     setSubjectToAll: (obj: cc.Node, root?: any, opts?: IccComponentObserverOpts) => void
// } = function (root?: any, opts: IccComponentObserverOpts = {}): Function {
//     return function (target: Function) {

//         target[ccComponentObserverConstructorMetaTag] = {root, opts};


//         boxing(target.prototype, 'onLoad', function () {
//             const instanceMeta = getInstanceMeta(this);
//             if (instanceMeta && !instanceMeta.opts.handleEnableDisable) {
//                 instanceMeta.observed = true;
//                 if (instanceMeta.root) {
//                     const observer = new ReactiveStoreObserver(instanceMeta.root, instanceMeta.opts.relativePath);
//                     instanceMeta.observer = observer;
//                     const getter = instanceMeta.opts.observeContextGetter;
//                     !instanceMeta.opts.noAutoBinding && observer.observeInstance(this, getter ? (_.isFunction(getter) ? getter(this) : getter) : this);
//                     if (!instanceMeta.opts.noRefresh) {
//                         observer.refreshAll();
//                     }
//                 }
//             }

//         });

//         boxing(target.prototype, 'onDestroy', function () {
//             const instanceMeta = getInstanceMeta(this);
//             const observer = instanceMeta.observer;
//             if (observer) {
//                 observer.releaseAll(this);
//             }
//             delete this[ccComponentObserverInstanceMetaTag];
//         });

//         boxing(target.prototype, 'onEnable', function () {
//             const instanceMeta = getInstanceMeta(this);
//             if (instanceMeta && instanceMeta.root && instanceMeta.opts.handleEnableDisable) {
//                 instanceMeta.observed = true;
//                 let observer = instanceMeta.observer;
//                 if (!observer) {
//                     observer = core.reactiveStore.createObserver(instanceMeta.root, instanceMeta.opts.relativePath);
//                     instanceMeta.observer = observer;
//                 }
//                 const getter = instanceMeta.opts.observeContextGetter;
//                 !instanceMeta.opts.noAutoBinding && observer.observeInstance(this, getter ? (_.isFunction(getter) ? getter(this) : getter) : this);
//                 if (!instanceMeta.opts.noRefresh) {
//                     observer.refreshAll();
//                 }
//             }
//         });

//         boxing(target.prototype, 'onDisable', function () {
//             const instanceMeta = getInstanceMeta(this);
//             if (instanceMeta && instanceMeta.opts.handleEnableDisable) {
//                 const observer = instanceMeta.observer;
//                 if (observer) {
//                     observer.releaseAll(this);
//                 }
//             }
//         });

//     };
// } as any;

// ccComponentObserver.setSubjectToAll = function (obj: cc.Node, root?: any, opts?: IccComponentObserverOpts) {
//     const components = obj['_components'];
//     _.each(components, (component) => {
//         ccComponentObserver.setSubject(component, root, opts);
//     });
// };

// ccComponentObserver.setSubject = function (obj: cc.Component, root?: any, opts?: IccComponentObserverOpts) {
//     const instanceMeta = getInstanceMeta(obj);
//     if (instanceMeta) {
//         let changes = 0;
//         const oldRoot = instanceMeta.root;
//         const oldRelativePath = instanceMeta.opts.relativePath;
//         const oldObserveContextGetter = instanceMeta.opts.observeContextGetter;

//         if (opts) {
//             _.assign(instanceMeta.opts, opts);
//         }

//         if (oldRoot !== root) {
//             instanceMeta.root = root;
//             changes++;
//         }

//         instanceMeta.opts.relativePath !== oldRelativePath && changes++;
//         instanceMeta.opts.observeContextGetter !== oldObserveContextGetter && changes++;

//         if (changes > 0) {
//             let observer = instanceMeta.observer;
//             if (observer) {
//                 !instanceMeta.root && !instanceMeta.opts.noRefresh && observer.refreshAll();
//                 observer.releaseAll(obj);
//             }

//             if (observer || instanceMeta.observed) {
//                 const refresh = !!observer;
//                 if (instanceMeta.root) {
//                     observer = new ReactiveStoreObserver(instanceMeta.root, instanceMeta.opts.relativePath);
//                     instanceMeta.observer = observer;
//                     const getter = instanceMeta.opts.observeContextGetter;
//                     observer.observeInstance(obj, getter ? (_.isFunction(getter) ? getter(this) : getter) : this);
//                     if (refresh || !instanceMeta.opts.noRefresh) {
//                         observer.refreshAll();
//                     }
//                 }
//                 else {
//                     delete instanceMeta.observer;
//                 }
//             }
//         }
//     }
// };

// export const observePropertyCCLabel = function (path: observePath, opt: {
//     converter?: (source: any) => string,
//     processor?: (ctx: { change: IReactiveStoreChange, item: cc.Label, opt }, next: () => Promise<any>) => Promise<void>
// } = {}): PropertyDecorator {
//     return observeProperty(path, {
//         callback: (change, item: cc.Label) => {
//             if (opt.processor) {
//                 core.composeFunction(opt.processor, () => {
//                     item.string = opt.converter ? opt.converter(change.value) : (change.value != undefined ? change.value : '');
//                 })({change, item, opt});
//             }
//             else {
//                 item.string = opt.converter ? opt.converter(change.value) : (change.value != undefined ? change.value : '');
//             }
//         }
//     });
// };