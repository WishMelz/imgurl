<template>
  <div>
    upload
    {{'token:'+this.$store.state.token}}
    <el-button @click="getApi">form</el-button>

    <el-upload
      class="upload-demo"
      drag
      action="https://jsonplaceholder.typicode.com/posts/"
      multiple
      :before-upload="befUpload"
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
      <div class="el-upload__tip" slot="tip">
        只能上传jpg/png文件，且不超过500kb
      </div>
    </el-upload>
  </div>
</template>

<script>
import {getUserInfo} from '@/api/api.js'
export default {
  methods: {
    getApi() {
      // 用户信息
    //   this.$axios('/user')
    //   .then(res=>{
    //       console.log(res);
    //   }).catch(err=>{
    //       console.log(err);
    //   })
    getUserInfo('48b3f0edc2a7bdb352ae6cd4b39aadfc26495597')
    .then(res=>{
        console.log(res);
    }).catch(err=>{
        console.log(err);
    })
    },
    befUpload(file) {
      console.log(file);
      var reader = new FileReader();
      reader.readAsDataURL(file);
      let _this = this;
      reader.onload = function () {
        console.log(reader.result.split(','));
        // return;
        let data = {
          message: "提交",
          content: reader.result.split(',')[1],
          branch:"main"
        };
        _this.$axios.put("/repos/wozuinbs/video/contents/z.jpg",data)
        .then(res=>{
            console.log(res);
        }).catch(err=>{
            console.log(err);
        })
      };
      return false;
    },
  },
};
</script>

<style>
</style>