
import request from '@/axios.js'

// 上传
export function upload(conf, data) {
    return request({
        url: `/repos/${conf.name}/${conf.repos}/contents${conf.cont}${conf.fileName}`,
        method: 'put',
        data
    })
}
