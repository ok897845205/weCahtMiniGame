import {CoreHost, core} from "../core/core";

declare global {
    interface CoreModule extends CoreHost {

    }
    interface AppModule extends CoreHost {

    }
}

export class AppCore {
    observer = core.reactiveStore.createObserver(core.root);
}

export const app: AppModule & AppCore = CoreHost.create('app', AppCore);
core.started(() => app.start());

console.log('app inited!');