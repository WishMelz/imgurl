import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from "vuex-persistedstate"
Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    token: '',
    userInfo: {},
    uploadInfo: {
      iscant: false,
      repos: "",
      content: "",
      delimit: "",
      branch:""
    },
    sign:"wishimg"
  },
  mutations: {
    setToken(state, v) {
      state.token = v;
    },
    setUserInfo(state, v) {
      state.userInfo = v;
    },
    setUploadInfo(state, v) {
      state.uploadInfo = v;
    },
    setSign(state,v){
      state.sign = v;
    }
  },
  actions: {
  },
  modules: {
  },
  plugins: [createPersistedState()]
})
