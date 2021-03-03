<template>
  <div id="user" v-loading.fullscreen.lock="fullscreenLoading">
    <el-row>
      <el-col :span="24">
        <el-input v-model="token" placeholder="请输入TOKEN进行初始化">
          <el-button slot="append" @click="searchUser" icon="el-icon-search"
            >查询</el-button
          >
        </el-input>
      </el-col>
      <el-col style="padding-top: 30px">
        <div class="select">
          <el-form ref="form" label-width="100px">
            <el-form-item label="头像">
              <el-avatar :size="50" :src="userInfo.avatar_url"></el-avatar>
            </el-form-item>
            <el-form-item label="用户名">
              <el-input :disabled="true" v-model="userInfo.login"></el-input>
            </el-form-item>
            <el-form-item label="地址">
              <el-input :disabled="true" v-model="userInfo.location"></el-input>
            </el-form-item>
            <el-form-item label="选择仓库">
              <el-select
                v-model="upForm.repos"
                placeholder="请选择"
                @change="selectRepos"
              >
                <el-option
                  v-for="(v, i) in reposList"
                  :key="i"
                  :label="v.name"
                  :value="v.name"
                >
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="选择目录">
              <el-select v-model="upForm.content" placeholder="请选择">
                <el-option
                  v-for="(v, i) in reposContents"
                  :key="i"
                  :label="v.name"
                  :value="v.val"
                >
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="自定义目录">
              <el-checkbox v-model="upForm.iscant"
                >点击使用自定义目录 -- 功能未完善，谨慎使用！</el-checkbox
              >
              <el-input
                :disabled="!upForm.iscant"
                v-model="upForm.delimit"
              ></el-input>
            </el-form-item>
            <el-form-item label="当前目录">
              <span v-if="!upForm.iscant">
                {{
                  `/repos/${userInfo.login}/${upForm.repos}/contents${upForm.content}`
                }}
              </span>
              <span v-else>
                {{
                  `/repos/${userInfo.login}/${upForm.repos}/contents${upForm.delimit}`
                }}
              </span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="setUploadInfo">确认设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { getUserInfo, getUserRepos, getReposContents } from "@/api/user";
export default {
  data() {
    return {
      fullscreenLoading: false,
      token: "",
      userInfo: {},
      reposList: [],
      reposContents: [],
      upForm: {
        iscant: false,
        repos: "",
        content: "",
        delimit: "",
      },
    };
  },
  created() {
    this.upForm = this.$store.state.uploadInfo;
    this.token = this.$store.state.token;
    this.userInfo = this.$store.state.userInfo;
    localStorage.setItem("token", this.$store.state.token);
    if (this.userInfo.login) {
      this.getRepos(this.userInfo.login);
    }
    if(this.upForm.repos != ''){
        this.selectRepos(this.upForm.repos)
    }
  },
  methods: {
    //   确定仓库路劲
    setUploadInfo(){
          this.$store.commit("setUploadInfo", this.upForm);
          this.$message.success('设置成功')
    },
    // 获取用户信息
    searchUser() {
      this.fullscreenLoading = true;
      localStorage.setItem("token", this.token);
      getUserInfo()
        .then((res) => {
          this.fullscreenLoading = false;
          this.userInfo = res;
          this.$store.commit("setToken", this.token);
          this.$store.commit("setUserInfo", res);
          this.getRepos(res.login);
        })
        .catch((err) => {
          this.fullscreenLoading = false;
          console.log(err);
        });
    },
    // 获取用户仓库
    getRepos(name) {
      getUserRepos(name)
        .then((res) => {
          this.reposList = res;
        })
        .catch((err) => {
          console.log(err);
        });
    },
    // 获取目录
    selectRepos(v) {
      getReposContents(this.userInfo.login, v)
        .then((res) => {
          let data = [
            {
              name: "/",
              val: "/",
            },
          ];
          res.forEach((v) => {
            if (v.type == "dir") {
              data.push({
                name: v.name,
                val: "/" + v.path,
              });
            }
          });
          this.reposContents = data;
        })
        .catch((err) => {
          console.log(err);
        });
    },
  },
};
</script>

<style>
table {
  /* margin: 0 auto; */
  margin-top: 30px;
}
table td {
  padding: 0 10px;
  text-align: center;
}
</style>