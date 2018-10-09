
import * as _ from 'lodash';
import {MapContainer} from "../container/mapContainer";

export interface IOnionRoute<TReq=any, TRes = any, TView=any> {
    route: string,
    req?: TReq;
    res?: TRes;
    state?: TView;
}

export type OnionMiddleware<TReq=any, TRes = any, TView=any> = (ctx: OnionContext<TReq, TRes, TView>, next?: () => Promise<void>) => (void | Promise<void>)

export interface IOnionHandleOpts {
    order?: number,
    id?: any,
}

export class OnionMiddlewareHost<TReq=any, TRes = any, TView=any> {

    private readonly rawMiddleware: OnionMiddleware<TReq, TRes, TView>[];
    private middleware: OnionMiddleware<TReq, TRes, TView>[];

    constructor(private readonly onion: Onion, public readonly route: string, fn: OnionMiddleware<TReq, TRes, TView> | OnionMiddleware[], public readonly opts: IOnionHandleOpts = {}) {
        this.rawMiddleware = _.isArray(fn) ? fn : [fn];
        this.middleware = this.rawMiddleware;
    }

    private _binder;
    get binder(): any {
        return this._binder;
    }

    bind(target: object): this {
        if (this.rawMiddleware) {
            this.middleware = _.map(this.rawMiddleware, (mid) => {
                return mid.bind(target);
            });
            this._binder = target;
            this.onion.mapBinder(this, target);
        }
        return this;
    }

    dispatch(): OnionMiddleware {
        return this.middleware && Onion.composeMiddleware(this.middleware);
    }

}

const onionHandlerTag = Symbol('onionHandlerTag');

export class OnionContext<TReq=any, TRes = any, TState=any> {

    private _errors: any[];

    get errors(): any[] {
        return this._errors;
    }

    readonly route: string;
    readonly req: TReq;
    readonly res: TRes;
    readonly state: TState = {} as any;
    handlerLength: number = 0;

    constructor(public readonly onion: Onion, routePath: string, route: IOnionRoute, req: any) {

        if (req === undefined) {
            if (route && route.req !== undefined) {
                req = _.cloneDeep(route.req);
            }
            else {
                req = {} as any;
            }
        }

        this.route = routePath;
        this.req = req;
        this.res = (route && route.res !== undefined) ? _.cloneDeep(route.res) : {};
    }

    throw(err) {
        if (!this._errors) {
            this._errors = [err];
        }
        else {
            this._errors.push(err);
        }
    }
}

export class OnionBroker {

    readonly promise;
    private resolve;
    private reject;

    constructor(public readonly routePath: string, public readonly ctx: OnionContext, private readonly fn?: OnionMiddlewareHost | OnionMiddleware | OnionMiddleware[]) {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        }).catch((error)=>{
            console.error("OnionBroker");
            throw new Error(error);
        });
    }

    flush(container) {
        if (container && container.middleware.length > 0) {

            let middleware = Onion.insertMiddleware(container.middleware, this.fn);

            const promise = Onion.composeMiddleware(middleware, fn => {
                return fn.dispatch ? fn.dispatch() : fn
            }, null, true)(this.ctx) as any;

            promise.then(() => {
                if (this.resolve) {
                    this.resolve(this.ctx);
                }
            }).catch((err) => {
                if (this.reject) {
                    this.reject(err);
                }
            });
        }
    }

}

export interface IMiddlewareContainer {
    idSet?: Set<string>,
    middleware: OnionMiddlewareHost[]
}


export default class Onion {

    private middlewareMap: MapContainer<string, IMiddlewareContainer> = new MapContainer();
    // private hostToBinder = new WeakMap();
    private binderToHosts: WeakMap<object, Set<OnionMiddlewareHost>> = new WeakMap();
    private onionHandlerMap = new WeakMap<object, Map<string, { route: string | IOnionRoute | ((context: object) => string), opts?: IOnionHandleOpts }[]>>();

    static composeMiddleware(middleware: any[], processor?: (fn: any) => OnionMiddleware, continues?: () => Promise<void>, attachLength?: boolean): OnionMiddleware {
        return function (ctx, next) {
            // last called middleware #
            let index = -1;
            return dispatch(0);

            function dispatch(i) {
                if (i <= index) return Promise.reject(new Error('next() called multiple times'));
                index = i;

                let fn = middleware[i];
                // console.log("sk_DEBUG dispatch", i, fn);
                if (i === middleware.length) fn = continues || next;
                if (fn && processor) {
                    fn = processor(fn);
                }
                if (!fn) return Promise.resolve();

                if (attachLength) {
                    ctx.handlerLength++;
                }

                if (ctx.errors) {
                    return Promise.resolve();
                }
                try {
                    return Promise.resolve(fn(ctx, function next() {
                        return dispatch(i + 1);
                    }));
                } catch (err) {
                    return Promise.reject(err);
                }
            }
        };
    }

    static insertMiddleware(middleware: any[], fn: OnionMiddlewareHost | OnionMiddleware | OnionMiddleware[]) {
        if (fn) {
            if (fn instanceof OnionMiddlewareHost) {
                middleware = [fn.dispatch(), ...middleware] as any;
            }
            else if (_.isArray(fn)) {
                middleware = [...fn, ...middleware] as any;
            }
            else {
                middleware = [fn, ...middleware] as any;
            }
        }
        return middleware;
    }


    onionHandler(route?: string | IOnionRoute | ((context: object) => string), opts?: IOnionHandleOpts): Function {
        const onionHandlerMap = this.onionHandlerMap;
        return function (target, propertyKey: string, descriptor) {
            // console.log(`register @${route} ${propertyKey}`);
            if (target) {
                let handler = onionHandlerMap.get(target);
                if (!handler) {
                    handler = new Map();
                    onionHandlerMap.set(target, handler);
                }

                let defs = handler.get(propertyKey);
                if (!defs) {
                    defs = [];
                    handler.set(propertyKey, defs);
                }
                defs.push({route, opts});
            }
        }
    }


    handleInstance(instance: object, context?: object): OnionMiddlewareHost[] {
        let hosts = [];
        if (instance) {
            for (const proto of [instance['__proto__'], instance['prototype']]) {
                if (proto) {
                    const handler = this.onionHandlerMap.get(proto);
                    if (handler) {
                        handler.forEach((defs, key) => {
                            const fn = instance[key] || proto[key];
                            if (fn && defs) {
                                defs.forEach(def => {
                                    // console.log("ss handleInstance", def.route, key, instance);
                                    hosts.push(this.handle(_.isFunction(def.route) ? def.route(context) : (def.route || key), fn, def.opts).bind(instance));
                                });
                            }
                        });
                    }
                }
            }
        }
        return hosts;
    }

    private getRoutes(route: string | IOnionRoute): [string, IOnionRoute] {
        let onionRoute: IOnionRoute;
        let routePath: string;
        if (_.isString(route)) {
            routePath = route;
        }
        else if (route.route) {
            onionRoute = route;
            routePath = route.route;
        }
        else {
            routePath = route.toString();
        }

        return [routePath, onionRoute];
    }

    handle<TReq=any, TRes=any, TView=any>(route: string | IOnionRoute<TReq, TRes, TView>, fn: OnionMiddlewareHost<TReq, TRes, TView> | OnionMiddleware<TReq, TRes, TView> | OnionMiddleware<TReq, TRes, TView>[], opts: IOnionHandleOpts = {}): OnionMiddlewareHost {
        const [routePath] = this.getRoutes(route);
        const container = this.middlewareMap.ensure(routePath, () => {
            return {middleware: []}
        });

        if (!(fn instanceof OnionMiddlewareHost)) {
            fn = new OnionMiddlewareHost(this, routePath, fn, opts);
        }

        const index = _.findIndex(container.middleware, (mid) => {
            return (mid.opts.order || 0) > (opts.order || 0);
        });
        if (index >= 0) {
            container.middleware.splice(index, 0, fn);
        }
        else {
            container.middleware.push(fn);
        }

        if (opts.id) {
            if (!container.idSet) {
                container.idSet = new Set([opts.id]);
            }
            else {
                container.idSet.add(opts.id);
            }
        }

        //console.log("[sk_DEBUG handler", routePath, container);

        this.processSolves(routePath, container);

        return fn;
    }


    async dispatch<TReq=object, TRes=any, TView=any>(route: string | IOnionRoute<TReq, TRes, TView>, args?: TReq & { [p: string ]: any } | OnionContext, fn?: OnionMiddlewareHost | OnionMiddleware | OnionMiddleware[]): Promise<OnionContext<TReq, TRes, TView> & { [p: string ]: any }> {
        try{
            const [routePath, onionRoute] = this.getRoutes(route);

            const ctx = args instanceof OnionContext ? args : new OnionContext(this, routePath, onionRoute, args);
            let container = this.middlewareMap.get(routePath);
            if (container) {
                let middleware = Onion.insertMiddleware(container.middleware, fn);

                await Onion.composeMiddleware(middleware, fn => {
                    return fn.dispatch ? fn.dispatch() : fn
                }, null, true)(ctx);
            }
            return ctx;
        }catch(err){
            console.error("dispatch err", err);
        }
    }

    private brokerMap: MapContainer<string, OnionBroker[]> = new MapContainer();
    private solveMap: MapContainer<string, { set: Set<any>, checkers: ((ctx: OnionContext) => any)[] }> = new MapContainer();

    async process<TReq=object, TRes=any, TView=any>(route: string | IOnionRoute<TReq, TRes, TView>, args?: TReq & { [p: string ]: any } | OnionContext, fn?: OnionMiddlewareHost | OnionMiddleware | OnionMiddleware[]): Promise<OnionContext<TReq, TRes, TView> & { [p: string ]: any }> {

        const [routePath, onionRoute] = this.getRoutes(route);

        const ctx = args instanceof OnionContext ? args : new OnionContext(this, routePath, onionRoute, args);

        const container = this.middlewareMap.get(routePath);
        if (container && this.processSolves(routePath, container)) {
            //直接执行
            let middleware = Onion.insertMiddleware(container.middleware, fn);

            await Onion.composeMiddleware(middleware, fn => {
                return fn.dispatch ? fn.dispatch() : fn
            }, null, true)(ctx);

            return ctx;
        }
        else {
            //挂起
            const broker = new OnionBroker(routePath, ctx, fn);
            const brokers = this.brokerMap.ensure(routePath, () => []);
            brokers.push(broker);
            return broker.promise;
        }
    }

    private processSolves(routePath: string, container: IMiddlewareContainer): boolean {
        if (container && container.middleware.length > 0) {
            let all = true;
            const solve = this.solveMap.get(routePath);
            if (solve) {

                // if (solve.checkers && solve.checkers.length > 0) {
                //     solve.checkers.forEach(checker => {
                //         all = checker();
                //     });
                // }

                if (solve.set && solve.set.size > 0) {
                    if (container.idSet && container.idSet.size > 0) {
                        solve.set.forEach(item => all && (all = container.idSet.has(item)));
                    }
                    else {
                        all = false;
                    }
                }
            }

            if (all) {
                const brokers = this.brokerMap.get(routePath);
                if (brokers) {
                    this.brokerMap.delete(routePath);
                    brokers.forEach((broker) => broker.flush(container));
                }

            }
            //console.log("[sk_DEBUG], processSolves", container, solve, brokers);
            return all;
        }

        return false;
    }


    // solve(route: string | OnionContext, ids?: string[]) {
    //
    //     let routePath: string;
    //     if (route instanceof OnionContext) {
    //         routePath = route.route;
    //     }
    //     else {
    //         routePath = route;
    //     }
    //
    //
    //     if (!ids || ids.length === 0) {
    //         this.flushBrokers(routePath);
    //         return true;
    //     }
    //
    //
    //     let container = this.middlewareMap.get(routePath);
    //     if (container && container.idSet && container.idSet.size > 0) {
    //         for (const id of ids) {
    //             if (!container.idSet.has(id)) {
    //                 return false;
    //             }
    //         }
    //         this.flushBrokers(routePath);
    //         return true;
    //     }
    //
    //     return false;
    // }

    handleSolve(route: string | IOnionRoute, checker: ((ctx: OnionContext) => Promise<void>) | string[]) {
        const [routePath] = this.getRoutes(route);

        let solves = this.solveMap.ensure(routePath, () => {
            return {set: new Set(), checkers: []};
        });

        if (_.isFunction(checker)) {
            solves.checkers.push(checker);
        }
        else if (_.isArray(checker)) {
            checker.forEach(item => solves.set.add(item))
        }
    }

    releaseSolve(route: string | IOnionRoute, checker?: ((ctx: OnionContext) => Promise<void>) | string[]) {
        const [routePath] = this.getRoutes(route);
        if (checker != null) {
            let solves = this.solveMap.get(routePath);
            if (solves) {
                if (_.isFunction(checker)) {
                    _.remove(solves.checkers, item => item === checker);
                }
                else if (_.isArray(checker)) {
                    checker.forEach(item => solves.set.delete(item))
                }

                if ((!solves.checkers || solves.checkers.length === 0)
                    && (!solves.set || solves.set.size === 0)) {
                    this.solveMap.delete(routePath);
                }
            }
        }
        else {
            this.solveMap.delete(routePath);
        }
    }

    releaseSolveAll() {
        this.solveMap.clear();
    }

    route<TReq=any, TRes=any, TView=any>(route: string | IOnionRoute<TReq, TRes, TView>): OnionMiddleware {
        return async (ctx, next) => {
            if (!_.isString(route)) {
                route = route.route;
            }
            const container = this.middlewareMap.get(route);
            if (container) {
                await Onion.composeMiddleware(container.middleware, fn => fn.dispatch ? fn.dispatch() : fn, next, true)(ctx);
                return;
            }
            await next();
        };
    }

    parallel() {

    }

    compose(...fn: Function[]): OnionMiddleware {
        return Onion.composeMiddleware(fn);
    }

    composePromise(...fn: Function[]): Promise<void> {
        return Onion.composeMiddleware(fn) as any;
    }

    composeFunction(...fn: Function[]): Function {
        return Onion.composeMiddleware(fn);
    }

    mapBinder(host, binder) {
        const hosts = this.binderToHosts.get(binder);
        if (!hosts) {
            this.binderToHosts.set(binder, new Set([host]));
            return;
        }
        hosts.add(host);
    }

    release(route: string | IOnionRoute, host?: OnionMiddlewareHost | OnionMiddleware | OnionMiddleware[]) {
        if (!_.isString(route)) {
            route = route.route;
        }

        if (arguments.length == 1) {
            this.middlewareMap.delete(route);
        }
        else {
            const container = this.middlewareMap.get(route);
            if (container) {
                const removes = _.remove(container.middleware, mid => mid === host);
                removes.forEach((remove) => {
                    if (remove.opts.id) {
                        if (!_.find(container.middleware, (mid) => mid.opts.id === remove.opts.id)) {
                            container.idSet.delete(remove.opts.id);
                        }
                    }
                })
            }
        }
    }

    releaseAll(binder?) {
        if (arguments.length == 0) {
            this.middlewareMap.clear();
        }
        else {
            const hosts = this.binderToHosts.get(binder);
            hosts && hosts.forEach((host) => {
                this.release(host.route, host);
            });
        }
        this.releaseSolveAll();
    }
}


// declare global {
//     interface CoreModule {
//         onion: new() => Onion
//     }
// }

// core.inject('onion', () => Onion);

