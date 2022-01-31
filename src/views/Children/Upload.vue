<template>
  <div id="upload" v-loading.fullscreen.lock="fullscreenLoading">
    <el-row>
      <el-col>
        <el-upload
          style="width: 100%"
          class="upload-demo"
          drag
          action="/"
          multiple
          :before-upload="befUpload"
        >
          <i class="el-icon-upload"></i>
          <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
          <div class="el-upload__text"><b>支持 ctrl + v 上传</b></div>
        </el-upload>
      </el-col>
      <el-col style="padding-top: 20px">
        <div class="tag-group">
          <el-tag effect="dark">仓库：{{ upForm.repos }}</el-tag>
          <el-tag effect="dark" v-if="upForm.iscant"
            >目录：{{ upForm.delimit }}</el-tag
          >
          <el-tag effect="dark" v-else>目录：{{ upForm.content }}</el-tag>
           <el-input @input='signInput' placeholder="请输入签名" size='mini'  style="width:250px" v-model="sign">
              <template slot="prepend">签名</template>
           </el-input>
           <span style="vertical-align: sub;font-size:10px;font-style: italic;">签名就是 <b>![]</b> 中的字</span>
        </div>
       
      </el-col>
      <el-col style="padding-top: 30px">
        <el-radio v-model="nameType" label="1">使用源文件名字</el-radio>
        <el-radio v-model="nameType" label="2">使用加密文件名字</el-radio>
      </el-col>
    </el-row>
    <el-divider></el-divider>
    <el-row>
      <el-col :span="16" class="resimg">
        <el-input v-model="resData[0]">
          <template slot="prepend">GitHub</template>
          <template slot="append">
            <el-button class="copy" @click="copy(resData[0])">复制</el-button>
          </template>
        </el-input>
        <el-input v-model="resData[1]">
          <template slot="prepend">jsDelivr</template>
          <template slot="append">
            <el-button class="copy" @click="copy(resData[1])">复制</el-button>
          </template>
        </el-input>
        <el-input v-model="resData[2]">
          <template slot="prepend">Markdown</template>
          <template slot="append">
            <el-button class="copy" @click="copy(resData[2])">复制</el-button>
          </template>
        </el-input>
        <el-tabs v-model="activeName" type="border-card" stretch>
          <el-tab-pane class="imgbox" label="GitHub预览" name="first">
            <el-image :src="resData[0]"></el-image>
          </el-tab-pane>
          <el-tab-pane class="imgbox" label="jsDelivr预览" name="second">
            <el-image :src="resData[1]"></el-image>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { upload } from "@/api/upload";
import md5 from "md5";
export default {
  data() {
    return {
      activeName: "first",
      fullscreenLoading: false,
      nameType: "2",
      upForm: {},
      userInfo: {},
      resUrl: "",
      resData: [],
      sign:"wishimg"
    };
  },
  created() {
    this.userInfo = this.$store.state.userInfo;
    this.upForm = this.$store.state.uploadInfo;
    this.sign = this.$store.state.sign;
  },

  mounted() {
    let _this = this;
    document.addEventListener("paste", function (event) {
      var isChrome = false;
      if (event.clipboardData || event.originalEvent) {
        //某些chrome版本使用的是event.originalEvent
        var clipboardData =
          event.clipboardData || event.originalEvent.clipboardData;
        if (clipboardData.items) {
          // for chrome
          var items = clipboardData.items,
            len = items.length,
            blob = null;
          isChrome = true;
          for (var i = 0; i < len; i++) {
            if (items[i].type.indexOf("image") !== -1) {
              //getAsFile() 此方法只是living standard firefox ie11 并不支持
              blob = items[i].getAsFile();
            }
          }
          if (blob !== null) {
            var reader = new FileReader();
            reader.readAsDataURL(blob);
            //base64码显示
            reader.onload = function (event) {
              // event.target.result 即为图片的Base64编码字符串
              var base64_str = event.target.result;
              _this.postUploadApi(
                md5(Math.random()) + ".png",
                base64_str.split(",")[1]
              );
            };
          }
        }
      }
    });
  },
  methods: {
    //签名
    signInput(v){
       this.$store.commit("setSign", v);
    },
    // 复制内容
    copy(val) {
      if (val == "" || !val) {
        return;
      }
      let oInput = document.createElement("input");
      oInput.value = val;
      document.body.appendChild(oInput);
      oInput.select();
      document.execCommand("Copy");
      this.$message({
        message: "复制成功",
        type: "success",
      });
      oInput.remove();
    },
    befUpload(file) {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      let _this = this;
      reader.onload = function () {
        _this.postUploadApi(file.name, reader.result.split(",")[1]);
      };
      return false;
    },
    postUploadApi(name, base64) {
      let _this = this;
      let urlInfo = {};
      // 判断是否自定义路劲
      if (!this.upForm.iscant) {
        urlInfo = {
          name: this.userInfo.login,
          repos: this.upForm.repos,
          cont: this.upForm.content,
        };
      } else {
        urlInfo = {
          name: this.userInfo.login,
          repos: this.upForm.repos,
          cont: this.upForm.delimit,
        };
      }
      let file_last = name.replace(/.+\./, "");
      //   判断文件名加密方式
      let fileName = "";
      if (this.nameType == "1") {
        fileName = name;
      } else {
        fileName = md5(Math.random() + name) + "." + file_last;
      }
      if (urlInfo.cont == "/") {
        urlInfo.fileName = fileName;
      } else {
        urlInfo.fileName = "/" + fileName;
      }
      _this.fullscreenLoading = true;
      let data = {
        message: "Upload pictures via wishmelz-imgurl",
        content: base64,
      };
      upload(urlInfo, data)
        .then((res) => {
          _this.resData[0] = res.content.download_url;
          if (_this.upForm.iscant) {
            _this.resData[1] = `https://cdn.jsdelivr.net/gh/${_this.userInfo.login}/${_this.upForm.repos}@${_this.upForm.branch}${_this.upForm.delimit}/${res.content.name}`;
          _this.resData[2] = `![${this.sign}](https://cdn.jsdelivr.net/gh/${_this.userInfo.login}/${_this.upForm.repos}@${_this.upForm.branch}${_this.upForm.delimit}/${res.content.name})`;
          } else {
            _this.resData[1] = `https://cdn.jsdelivr.net/gh/${_this.userInfo.login}/${_this.upForm.repos}@${_this.upForm.branch}${_this.upForm.content}/${res.content.name}`;
            _this.resData[2] = `![${this.sign}](https://cdn.jsdelivr.net/gh/${_this.userInfo.login}/${_this.upForm.repos}@${_this.upForm.branch}${_this.upForm.content}/${res.content.name})`;
          }

          _this.fullscreenLoading = false;
          _this.$message.success("上传成功");
        })
        .catch((err) => {
          console.log(err);
          _this.fullscreenLoading = false;
        });
    },
  },
};
</script>

<style>
.el-upload,
.el-upload-dragger {
  width: 100%;
}
.tag-group .el-tag {
  margin-right: 10px;
}
.resimg img {
  max-width: 100%;
  max-height: 100%;
}
.copy {
  cursor: pointer;
}
.imgbox {
  text-align: center;
}
</style>