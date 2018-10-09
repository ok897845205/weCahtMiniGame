import {core} from "./core/core";

function registerGameOn(){
    cc.game.on(cc.game.EVENT_GAME_INITED, event => {
        core.start();
    });
}


if (typeof cc !== 'undefined') {
    cc.director.on(cc.Director.EVENT_BEFORE_SCENE_LOADING, function (res) {
        console.log("director scene", res);

    });
    registerGameOn();
}