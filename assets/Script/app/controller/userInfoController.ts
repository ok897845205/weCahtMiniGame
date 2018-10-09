
import {app} from "../app";

export class UserInfoController {
    init() {
        console.warn("userInfoController init")
    }
};

declare global {
    interface AppModule {
        userInfoController: UserInfoController
    }
};

app.inject('userInfoController', () => new UserInfoController());

app.started(() => {
    app.userInfoController.init();
});