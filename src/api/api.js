import request from '@/axios.js'


export function getUserInfo (token) {
    return request({
        url: `/user`,
        method: 'get',
        headers:{
            Authorization:`token ${token}`
        }
    })
}