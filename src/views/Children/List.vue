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
        <el-button @click="isjsDeliver = !isjsDeliver"
          >切换外链接格式</el-button
        >
      </el-col>
      <el-col>
        <div class="item" v-for="(v, i) in dataList" :key="i">
          <div class="del" @click="delFile(v)">
            <i class="el-icon-delete"></i>
          </div>
          <el-image
            @click="opDia(imgurl + v.path)"
            style="width: 200px; height: 200px; cursor: pointer"
            :src="isjsDeliver ? imgurl + v.path : v.download_url"
            fit="cover"
          ></el-image>
          <el-button size="mini" @click="copy(1, imgurl + v.path)"
            >复制外链</el-button
          >
          <el-button size="mini" @click="copy(2, imgurl + v.path)"
            >复制MD格式</el-button
          >
        </div>
      </el-col>
    </el-row>
    <div class="dialog" v-if="dialogTableVisible">
      <div class="dialog-close">
        <i @click="diaClose" class="el-icon-circle-close"></i>
      </div>
      <img class="diaimg" @click="diaClose" :src="dialogUrl" />
    </div>
  </div>
</template>

<script>
import { getUserRepos, getReposContents } from "@/api/user";
import { getFileList, delFile } from "@/api/list";
export default {
  data() {
    return {
      dialogTableVisible: false,
      fullscreenLoading: false,
      dialogUrl: "",
      repoData: {},
      userInfo: {},
      reposList: [],
      reposContents: [],
      dataList: [],
      upForm: {
        repos: "",
        content: "",
      },
      imgurl: "",
      isjsDeliver: false,
      sign:""
    };
  },
  created() {
    this.repoData = this.$store.state.uploadInfo;
    this.userInfo = this.$store.state.userInfo;
     this.sign = this.$store.state.sign;
    this.defSelect();
  },
  methods: {
    opDia(v) {
      this.dialogTableVisible = true;
      this.dialogUrl = v;
    },
    diaClose() {
      this.dialogTableVisible = false;
      this.dialogUrl = "";
    },
    // 默认选中操作
    defSelect() {
      this.getRepos(this.userInfo.login);
      this.selectRepos(this.$store.state.uploadInfo.repos);
      this.upForm.repos = this.$store.state.uploadInfo.repos;
      this.upForm.content = this.$store.state.uploadInfo.content;
      if(this.$store.state.uploadInfo.iscant){
         this.upForm.content = this.$store.state.uploadInfo.delimit;
      }
      this.getList();
    },
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
      if (!v) return;
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
      if (
        this.userInfo.login == "" ||
        this.upForm.repos == "" ||
        this.upForm.content == "" ||
        !this.userInfo.login ||
        !this.upForm.repos ||
        !this.upForm.content
      ) {
        this.$message.info("请选择仓库和目录");
        return;
      }
      this.fullscreenLoading = true;
      this.imgurl = `https://cdn.jsdelivr.net/gh/${this.userInfo.login}/${this.upForm.repos}/`;
      getFileList(this.userInfo.login, this.upForm.repos, this.upForm.content)
        .then((res) => {
          this.dataList = res;
          this.fullscreenLoading = false;
        })
        .catch((err) => {
          console.log(err);
          this.fullscreenLoading = false;
        });
    },
    // 复制内容
    copy(type, val) {
      // type 1 link  2 MD
      let copyCont = "";
      if (type == 1) {
        copyCont = val;
      } else {
        copyCont = `![${this.sign}](${val})`;
      }
      let oInput = document.createElement("input");
      oInput.value = copyCont;
      document.body.appendChild(oInput);
      oInput.select();
      document.execCommand("Copy");
      this.$message({
        message: "复制成功",
        type: "success",
      });
      oInput.remove();
    },
    // 删除文件
    delFile(v) {
      this.$confirm("此操作将永久删除该文件, 是否继续?", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      })
        .then(() => {
          let data = {
            message: "delete a file via wishimgurl",
            sha: v.sha,
          };
          this.fullscreenLoading = true;
          delFile(this.userInfo.login, this.upForm.repos, v.path, data)
            .then((res) => {
              console.log(res);
              this.$message.success("删除成功");
              this.getList();
              this.fullscreenLoading = false;
            })
            .catch((err) => {
              console.log(err);
              this.fullscreenLoading = false;
            });
        })
        .catch(() => {
          this.$message({
            type: "info",
            message: "已取消删除",
          });
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
  position: relative;
}
.imgerr {
  text-align: right;
}
.item .del {
  display: none;
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 999999999;
  cursor: pointer;
  border: 1px solid #ccc;
}
.item:hover .del {
  display: block;
}
.dialog {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.7);
}
.dialog-close {
  font-size: 40px;
  position: absolute;
  top: 20px;
  right: 20px;
}
.el-icon-circle-close {
  cursor: pointer;
}
.diaimg {
  max-height:100vh
}
</style>