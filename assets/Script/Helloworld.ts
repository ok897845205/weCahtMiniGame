import * as _ from 'lodash';
import {core} from "./core/core";
import {app} from "./app/app";
import {observe, observeProperty} from "./core/reactiveObserver/observer";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Helloworld extends cc.Component {

    @property(cc.Label)
    label: cc.Label = null;

    @property
    text: string = 'hello';

    onLoad() {
        core.handleInstance(this);

        // 测试@observe装饰器
        console.warn("================ 测试@observe装饰器 ")
        core.reactiveStore.set(core.root, "testArray", []);
        app.observer.observeInstance(this, {testIndex: 1});
        // app.observer.refreshAll();

        
    }

    onDestroy() {
        core.releaseAll(this);
        app.observer.releaseAll(this);
    }

    start () {
        
        this.label.string = this.text;

        setTimeout(() => {
            core.reactiveStore.set(core.root, "testArray[1]", {test: 123});
        }, 2000);
        
    }

    @observe(core.utils.templateString`testArray[${'testIndex'}]`)
    onTestObserveTemplateString(change){
        console.log(`onTestObserveTemplateString`, change)
    }

    @observe(`testArray.testArrayV2`)
    onTestObserve(change){
        console.log(`onTestObserve`, change)
    }

    
    @core.onionHandler("test.declare")
    async testDeclare(context, next) {
        console.log(" test.declare ", context);
        context.res = {dddd: "aaaaa"};
        await next();
    }
}
