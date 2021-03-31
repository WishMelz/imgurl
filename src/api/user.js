import request from '@/axios.js'

// 获取用户信息
export function getUserInfo (token) {
    return request({
        url: `/user`,
        method: 'get',
        headers:{
            Authorization:`token ${token}`
        }
    })
}

// 获取用户的仓库
export function getUserRepos (name) {
    return request({
        url: `/users/${name}/repos`,
        method: 'get'
    })
}
// 获取用户仓库下的目录
export function getReposContents (name,repos) {
    return request({
        url: `/repos/${name}/${repos}/contents`,
        method: 'get'
    })
}

// 获取仓库默认分支
export function getReposBranch (name,repos) {
    return request({
        url: `/repos/${name}/${repos}`,
        method: 'get'
    })
}