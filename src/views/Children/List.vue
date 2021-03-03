<template>
  <div v-loading.fullscreen.lock="fullscreenLoading">
    <el-row>
      <el-col>
        <el-select
          v-model="upForm.repos"
          placeholder="请选择仓库"
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
        <el-select v-model="upForm.content" placeholder="请选择目录">
          <el-option
            v-for="(v, i) in reposContents"
            :key="i"
            :label="v.name"
            :value="v.val"
          >
          </el-option>
        </el-select>
        <el-button @click="getList">获取列表</el-button>
      </el-col>
    </el-row>
    <el-row style="padding-top: 20px">
      <el-col class="imgerr">
          图片加载不出来？
          <el-button>切换外链接格式</el-button>
      </el-col>
      <el-col >
        <!-- https://raw.githubusercontent.com/WishMelz/file/master/image/6e8ad68d414b79f4fa49d6445444714b.jpeg -->
        <div class="item" v-for="i in 10" :key="i">
          <el-image
            style="width: 200px; height: 200px"
            src="https://raw.githubusercontent.com/WishMelz/file/master/image/6e8ad68d414b79f4fa49d6445444714b.jpeg"
            fit="cover"
          ></el-image>
          <el-button size="mini">复制外链</el-button>
          <el-button size="mini">复制MD格式</el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { getUserInfo, getUserRepos, getReposContents } from "@/api/user";
import { getFileList } from "@/api/list";
export default {
  data() {
    return {
      fullscreenLoading: false,
      repoData: {},
      userInfo: {},
      reposList: [],
      reposContents: [],
      dateList:[],
      upForm: {
        repos: "",
        content: "",
      },
      imgurl:""
    };
  },
  created() {
    this.repoData = this.$store.state.uploadInfo;
    this.userInfo = this.$store.state.userInfo;
    console.log(this.userInfo);
    this.getRepos(this.userInfo.login);
  },
  methods: {
    // 获取用户仓库
    getRepos(name) {
      this.fullscreenLoading = true;
      getUserRepos(name)
        .then((res) => {
          this.reposList = res;
          this.fullscreenLoading = false;
        })
        .catch((err) => {
          console.log(err);
          this.fullscreenLoading = false;
        });
    },
    // 获取目录
    selectRepos(v) {
      this.fullscreenLoading = true;
      this.upForm.content = "";
      getReposContents(this.userInfo.login, v)
        .then((res) => {
          let data = [];
          res.forEach((v) => {
            if (v.type == "dir") {
              data.push({
                name: v.name,
                val: "/" + v.path,
              });
            }
          });
          this.reposContents = data;
          this.fullscreenLoading = false;
        })
        .catch((err) => {
          console.log(err);
          this.fullscreenLoading = false;
        });
    },
    // 搜索按钮
    getList() {
      if (this.upForm.repos == "" || this.upForm.content == '') {
        this.$message.info("请选择仓库和目录");
        return;
      }
      getFileList(this.userInfo.login, this.upForm.repos, this.upForm.content)
        .then((res) => {
          console.log(res);
        })
        .catch((err) => {
          console.log(err);
        });
    },
  },
};
</script>

<style scoped>
.item {
  width: 200px;
  display: inline-block;
  padding: 5px;
  text-align: center;
  box-shadow: 0 0 1px 0;
}
.imgerr {
  text-align: right;
}
</style>