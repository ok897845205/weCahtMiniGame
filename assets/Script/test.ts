
const {ccclass, property} = cc._decorator;
import {core} from "./core/core";
import {app} from "./app/app";
import * as _ from 'lodash';

@ccclass
export class test extends cc.Component {
    start () {
        core.reactiveStore.set(core.root.testArray, "testArrayV2", {test: 456});

        setTimeout(() => {
            this.init()
        }, 2000);
    }

    async init(){
        // 测试@core.onionHandler装饰器
        let data = {
            a: "p",
            b: "o",
        }
        const {res} = await core.dispatch("test.declare", data);
        console.log("sk_DEBUG core.dispatch test.declare", res);
    }
}
