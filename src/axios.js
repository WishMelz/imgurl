import axios from "axios";
import {Message} from 'element-ui';
import router from '@/router'
function errorCreate(msg) {
  const error = new Error(msg)
  errorLog(error)
  throw error
}
// 记录和显示错误
function errorLog(error) {
  // 显示提示
  Message({
      message: error,
      type: 'error',
      duration: 5 * 1000
  })
}

const service = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 50000 // 请求超时时间
})
// 请求拦截
service.interceptors.request.use(config => {
  let token = localStorage.getItem('token')
  config.headers.Authorization = `token ${token}`;
  return config;
});

/// 响应拦截器
service.interceptors.response.use(
  response => {
      // dataAxios 是 axios 返回数据中的 data
      const dataAxios = response.data
      // 这个状态码是和后端约定的
      const { code } = dataAxios
      // 根据 code 进行判断
      if (code === undefined) {
          return dataAxios
      } else {
          // 有 code 代表这是一个后端接口 可以进行进一步的判断
          switch (code) {
              case 200:
                  // [ 示例 ] code === 0 代表没有错误
                  return dataAxios.data
              case 400:
                  break
              default:
                  // 不是正确的 code
                  errorCreate(`${dataAxios.content}: ${response.config.url}`)
                  break
          }
      }
  },
  error => {
      if (error && error.response) {
          switch (error.response.status) {
              case 400:
                  error.message = '请求错误';
                  break
              case 401:
                  error.message = '未授权，请登录';
                  break
              case 403:
                  error.message = '拒绝访问';
                  break
              case 404:
                  error.message = `请求地址出错: ${error.response.config.url}`;
                  break
              case 408:
                  error.message = '请求超时';
                  break
              case 500:
                  error.message = '服务器内部错误';
                  break
              case 501:
                  error.message = '服务未实现';
                  break
              case 502:
                  error.message = '网关错误';
                  break
              case 503:
                  error.message = '服务不可用';
                  break
              case 504:
                  error.message = '网关超时';
                  break
              case 505:
                  error.message = 'HTTP版本不受支持';
                  break
              default:
                  break
          }
      }
      errorLog(error)
      return Promise.reject(error)
  }
)


export default service