export default (function Router() {
  let currentRoute = { path: '' };// 当前路由
  let history = [];   // 历史记录
  let registerComponents = new Map();
  let routeRecord = Object.create(null); // 路由页面
  let waitCallComponents = []; //待渲染页面
  let beforeChangeMap = Object.create(null);// 路由守卫
  let afterChangeMap = Object.create(null);// 跳转后回调

  function _routerInit() {
    currentRoute = { path: '' };             // 当前路由
    history = [];                            // 历史记录
    registerComponents = new Map();
    routeRecord = Object.create(null);       // 路由页面
    waitCallComponents = [];                 //待渲染页面
    beforeChangeMap = Object.create(null);   // 路由守卫
    afterChangeMap = Object.create(null);    // 跳转后回调
  }
  /**
   * 路由初始化
   * @param {*} route 当前路由
   * @param {*} parentMap 父路由
   */
  function _recordInit(route, parentPath = "") {
    /**
     * 初始化路由表
     */
    const currRouteKey = route.path;
    routeRecord[parentPath + currRouteKey] = route;
    route.$path = parentPath + currRouteKey;
    if (route.children && route.children.length) { // 含有子路由
      const children = route.children;
      if (!Array.isArray(children)) throw new Error('route.children must be typeof array!'); // 类型校验
      children.forEach(child => _recordInit(child, parentPath + currRouteKey))
    }
  }

  /**
   * 路由匹配
   * @param {*} route 目标路由
   */
  function _matchRouteRecord(path, componentList = []) {
    while (path) {
      const targetRoute = routeRecord[path];
      if (!targetRoute) throw new Error('can not find path: ' + path);
      const index = path.lastIndexOf('/');
      const prevPath = path.slice(0, index);
      const name = path.replace(prevPath + '/', '');
      componentList.unshift(targetRoute.component || name);  // 放入组件列表
      path = prevPath;
    }
    return componentList
  }

  /**
   * 刷新页面
   * @param {array}} componentList 组件列表
   */
  function _freshView(componentList) {
    waitCallComponents = componentList; // 待渲染组件
    for (let component of registerComponents.values()) {
      const oldName = component.data.name;  // 旧组件
      const newName = waitCallComponents.shift(); // 新组件
      component.setData({ name: newName });
      if (oldName !== newName) break;// 路由改变
    }
  }


  /**
   * 跳转前确认
   * @param {*} 跳转目标页面
   */
  function _invokeBeforeHooks(nextRoute) {
    const fns = Object.values(beforeChangeMap);
    if (fns.length === 0) return true;
    for (let fn of fns)
      if (!fn(currentRoute, nextRoute)) return false;
    return true;
  };

  /**
   * 跳转成功回调
   */
  function _invokeAfterHooks() {
    const fns = Object.values(afterChangeMap);
    if (fns.length === 0) return;
    for (let fn of fns) fn();
  }

  /**
   * 构造函数
   * @param config
   */
  function constructor(config) {
    if (!Array.isArray(config.routes)) throw new Error('config.routes must be typeof array!'); // 类型校验
    _routerInit();
    config.routes.forEach(route => _recordInit(route));  // routeRecord 构造
    let initPath = config.option && config.option.initPath || '/';    // 默认路由
    push(initPath);
    const instance = {};
    Object.defineProperties(instance, {
      'currentRoute': {
        get: () => currentRoute,
        enumerable: true
      },
      'history': {
        value: history,
        enumerable: true
      },
      'routeRecord': {
        value: clone(routeRecord)
      },
      'registerComponent': {
        value: registerComponent
      },
      'removeComponent': {
        value: removeComponent
      },
      'setBeforeChange': {
        value: setBeforeChange
      },
      'removeBeforeChange': {
        value: removeBeforeChange
      },
      'setAfterChange': {
        value: setAfterChange
      },
      'removeAfterChange': {
        value: removeAfterChange
      },
      'push': {
        value: push
      },
      'replace': {
        value: replace
      },
      'back': {
        value: back
      }
    })
    return instance;
  }

  /**
   * 组件注册
   * @param {*} component
   */
  function registerComponent(component) {
    let $id = component.$id;
    if (waitCallComponents.length > 0) {
      component.setData({ name: waitCallComponents.shift() }); // 取出待渲染组件中的第一个渲染
    }
    registerComponents.set($id, component);
  }


  /**
   * 组件注销
   * @param {*} component
   */
  function removeComponent(component) {
    let $id = component.$id;
    if (!registerComponents.delete($id)) {
      throw new Error('delete router fail');
    }
  }

  /**
   * 路由跳转
   * @param {object} param 跳转参数
   * @param {string} param.path 跳转路径
   */
  function push(param) {
    let route = typeof param === 'string' ? { path: param } : param;
    if (route.snapshot) {                                             //  缓存快照
      history[history.length - 1].snapshot = route.snapshot;
      delete route.snapshot;
    }
    if (!route.path) throw new Error('missing required param: path'); // 类型校验
    const targetRoute = routeRecord[route.path];
    const componentList = _matchRouteRecord(route.path); // 获取目标路由
    if (!targetRoute) throw Error('path ' + route.path + 'not found!');
    const nextRoute = clone({ ...targetRoute, ...route });
    if (!_invokeBeforeHooks(nextRoute)) return;  // 阻止跳转
    currentRoute = nextRoute;
    history.push(nextRoute);
    if (history.length > 10) history.unshift();
    _invokeAfterHooks && _invokeAfterHooks();
    _freshView(componentList); // 刷新页面
  }

  /**
   * 路由跳转（替换当前页面栈）
   * @param {object} param 跳转参数
   * @param {string} param.path 跳转路径
   */
  function replace(param) {
    let route = typeof param === 'string' ? { path: param } : param;
    if (route.snapshot) {                                             //  缓存快照
      history[history.length - 1].snapshot = route.snapshot;
      delete route.snapshot;
    }
    if (!route.path) throw new Error('missing required param: path'); // 类型校验
    const targetRoute = routeRecord[route.path];
    const componentList = _matchRouteRecord(route.path); // 获取目标路由
    if (!targetRoute) throw Error('path ' + route.path + 'not found!');
    const nextRoute = clone({ ...targetRoute, ...route });
    if (!_invokeBeforeHooks(nextRoute)) return; // 阻止跳转
    currentRoute = nextRoute;
    history.pop();
    history.push(nextRoute);
    _invokeAfterHooks && _invokeAfterHooks();
    _freshView(componentList); // 刷新页面
  };

  /**
   * 路由返回
   * @param {object} param 跳转参数
   */
  function back(param = {}) {
    if (history.length < 2) return;
    const prev = history[history.length - 1 - (param.count || 1)];
    delete param.count;
    const targetRoute = routeRecord[prev.path];
    const componentList = _matchRouteRecord(prev.path); // 获取目标路由
    if (!targetRoute) throw Error('path ' + prev.path + 'not found!');
    const nextRoute = clone({ ...targetRoute, ...prev, ...param });
    if (!_invokeBeforeHooks(nextRoute)) return; // 阻止跳转
    delete prev.snapshot;                       // 删除快照
    history.splice(history.length - 1, 1);
    currentRoute = nextRoute;
    _invokeAfterHooks && _invokeAfterHooks();
    _freshView(componentList); // 刷新页面
  };

  /**
   * 设置跳转前监听
   * @param {*} page 当前页面实例
   * @param {*} methodName 监听方法
   */
  function setBeforeChange(pointer, methodName) {
    if (pointer === null) return;
    if (pointer[methodName] instanceof Function) {
      beforeChangeMap[`${pointer.$id}-${methodName}`] = pointer[methodName].bind(pointer);
    }
  }
  /**
   * 设置跳转后回调
   * @param {*} page 当前页面实例
   * @param {*} methodName 回调方法
   */
  function setAfterChange(pointer, methodName) {
    if (pointer === null) return
    if (pointer[methodName] instanceof Function) {
      afterChangeMap[`${pointer.$id}-${methodName}`] = pointer[methodName].bind(pointer);
    }
  }
  /**
   * 删除跳转前监听
   * @param {*} page 当前页面实例
   * @param {*} methodName 监听方法
   */
  function removeBeforeChange(pointer, methodName) {
    if (pointer === null) return;
    if (pointer[methodName] instanceof Function) {
      delete beforeChangeMap[`${pointer.$id}-${methodName}`];
    }
  }

  /**
   * 删除跳转后回调
   * @param {*} page 当前页面实例
   * @param {*} methodName 回调方法
   */
  function removeAfterChange(pointer, methodName) {
    if (pointer === null) return
    if (pointer[methodName] instanceof Function) {
      delete afterChangeMap[`${pointer.$id}-${methodName}`];
    }
  }

  return constructor;
})()

/**
 * 简单版深克隆（除函数，正则，原型链以及Symbol）
 */
function clone(target, map = new WeakMap()) {
  const base_type = typeof target;
  /**
   * null,function以及基本数据类型，直接返回
   */
  if (target === null || base_type === 'function' || base_type !== 'object') {
    return target
  }
  /**
   * 获取对象准确类型
   */
  const type = Object.prototype.toString.call(target);
  /**
   * 基本包装类型
   */
  if (['[object Boolean]', '[object Number]', '[object String]', '[object Date]'].includes(type)) {
    return new target.constructor(target);
  }
  /**
   * 忽略正则，symbol，函数，Error
   */
  if (['[object RegExp]', '[object Error]', '[object Symbol]', '[object Function]'].includes(type)) {
    return target;
  }

  /**
   * 剩余为可继续遍历类型
   */
  let result = target.constructor ? new target.constructor() : Object.create(target.prototype || null); // 新建对象
  /**
   * 循环引用处理
   */
  const targe = map.get(target);
  if (targe) return targe;
  map.set(target, result);
  /**
   *  map处理
   */
  if (type === '[object Map]') {
    for (let [k, v] of target) {
      result.set(k, clone(v, map))
    }
  }
  /**
   *  set处理
   */
  if (type === '[object Set]') {
    for (let v of target) {
      result.add(clone(v, map))
    }
  }
  /**
   * 对象处理
   */
  if (type === '[object Object]') {                  // 递归对象
    Object.keys(target).forEach(key => {
      result[key] = clone(target[key], map);
    })
  }

  if (type === '[object Array]') {               // 数组
    for (let i = 0; i < target.length; i++) {
      result[i] = clone(target[i], map)
    }
  }
  return result;
}
