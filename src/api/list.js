import request from '@/axios.js'


// 获取列表-- 1k 以内  
export function getFileList(name, repo, folder) {
    return request({
        url: `/repos/${name}/${repo}/contents/${folder}`,
        method: 'get'
    })
}



// 删除文件
export function delFile(name, repo, file, data) {
    return request({
        url: `/repos/${name}/${repo}/contents/${file}`,
        method: 'delete',
        data
    })
}


// 获取列表-- 超出1k的情况下
export function getFileListSha(name, repos, sha) {
    return request({
        url: `/repos/${name}/${repos}/git/trees/${sha}`,
        method: 'get'
    })
}

// 删除文件-- 超出1k的情况下
/**
 * 
 * @param {请求体} data   {message：'delete',sha:"sha"}
 */
export function delFileSha(name, repo, file, data) {
    return request({
        url: `/repos/${name}/${repo}/contents/${file}`,
        method: 'delete',
        data
    })
}