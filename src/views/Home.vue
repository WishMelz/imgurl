<template>
  <el-container>
    <el-header style=""> </el-header>
    <el-container>
      <el-aside width="200px">
        <a target="_black" href="https://github.com/WishMelz">
          <div class="avarat">
            <img
              src="https://avatars.githubusercontent.com/u/46024400?v=4"
              alt=""
            />
            <span>WishMelz</span>
          </div>
        </a>
        <a target="_black" href="https://wishmelz.github.io/imgur">
          <div class="imgur">
            Imgur
          </div>
        </a>
        <el-menu
          default-active="2"
          class="el-menu-vertical-demo"
          background-color="#545c64"
          text-color="#fff"
          active-text-color="#ffd04b"
          router
        >
          <el-menu-item index="user">
            <i class="el-icon-setting"></i>
            <span slot="title">配置</span>
          </el-menu-item>
          <el-menu-item index="upload">
            <i class="el-icon-upload"></i>
            <span slot="title">上传</span>
          </el-menu-item>
          <el-menu-item index="list">
            <i class="el-icon-more"></i>
            <span slot="title">列表</span>
          </el-menu-item>
          <el-menu-item index="/">
            <i class="el-icon-s-opportunity"></i>
            <span slot="title">教程</span>
          </el-menu-item>
          <el-menu-item @click="closeToken">
            <i class="el-icon-error"></i>
             <span slot="title">清除Token(退出)</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-main>
          <!-- <keep-alive> -->
          <router-view />
          <!-- </keep-alive> -->
        </el-main>
        <el-footer></el-footer>
      </el-container>
    </el-container>
  </el-container>
</template>

<script>
export default {
  methods: {
    closeToken() {
      localStorage.clear();
      this.$router.push("/");
    },
    goGithub() {
      location.href = "";
    },
  },
};
</script>

<style>
section {
  height: 100%;
}
.el-aside {
  background: #555c63;
  position: relative;
}
.el-header {
  background: #555c63;
}
.link {
  font-size: 14px;
  font-weight: bold;
  padding-left: 5px;
}
.avarat {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #ccc;
  padding-top: 10px;
}
.avarat img {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-right: 5px;
}
.avarat span {
  color: #fff;
  font-weight: bold;
  font-size: 14px;
}
.imgur {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: bold;
  font-size: 20px;
}
</style>