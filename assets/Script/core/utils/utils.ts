import _ = require("lodash");

export default class Utils {
    extract<T extends object | any[]>(origin: T, predicate: (value, key: string | number) => boolean): T {
        if (origin instanceof Array) {
            const result = [];

            for (let i = 0; i < origin.length; i++) {
                const item = origin[i];

                if (!predicate(item, i)) continue;

                result.push(item);
                origin.splice(i, 1);
                i--;
            }

            return <T>result;
        } else {
            const result = {};

            _.forEach(origin, (x, y) => {
                if (!predicate(x, y)) return;

                result[y] = x;
                delete origin[y];
            });

            return <T>result;
        }
    }

    private pathMap: Map<string, string[]> = new Map();

    toPath(path: string | string[]) {
        if (_.isArray(path)) {
            return path;
        }
        let ps = this.pathMap.get(path);
        if (!ps) {
            ps = _.toPath(path);
            this.pathMap.set(path, ps);
        }
        return ps;
    }

    templateString(strings, ...keys): (context: object) => string {
        return (function (context: object) {
            const result = [strings[0]];
            keys.forEach(function (key, i) {
                let value = context && context[key];
                if (_.isFunction(value)) {
                    value = value();
                }
                if (value == null) {
                    value = key;
                }
                result.push(value.toString(), strings[i + 1]);
            });
            return result.join('');
        });
    }

    /*
    ** 时间戳转换成指定格式日期
    ** eg. 
    ** dateFormat(11111111111111, 'Y年m月d日 H时i分')
    ** → "2322年02月06日 03时45分"
    */
   formatTimeStamp2(timestamp, formats) {
        // formats格式包括
        // 1. Y-m-d
        // 2. Y-m-d H:i:s
        // 3. Y年m月d日
        // 4. Y年m月d日 H时i分
        formats = formats || 'Y-m-d';
    
        var zero = function (value) {
            if (value < 10) {
                return '0' + value;
            }
            return value;
        };
    
        var myDate = timestamp? new Date(timestamp): new Date();
    
        var year = myDate.getFullYear();
        var month = zero(myDate.getMonth() + 1);
        var day = zero(myDate.getDate());
    
        var hour = zero(myDate.getHours());
        var minite = zero(myDate.getMinutes());
        var second = zero(myDate.getSeconds());
    
        return formats.replace(/Y|m|d|H|i|s/ig, function (matches) {
            return ({
                Y: year,
                m: month,
                d: day,
                H: hour,
                i: minite,
                s: second
            })[matches];
        });
    };
    

}

