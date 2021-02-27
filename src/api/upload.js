
import request from '@/axios.js'

// 获取用户信息
export function upload(conf, data) {
    return request({
        url: `/repos/${conf.name}/${conf.repos}/contents${conf.cont}${conf.fileName}`,
        method: 'put',
        data
    })
}


// repos/wozuinbs/video/contents/z.jpg