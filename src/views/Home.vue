<template>
  <el-container>
    <el-header>
      
    </el-header>
    <el-container>
      <el-aside width="200px">
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
           <!-- <el-menu-item index="43">
            <i class="el-icon-setting"></i>
            <span slot="title">导航4</span>
          </el-menu-item> -->
        </el-menu>
      </el-aside>
      <el-container>
        <el-main>
            <router-view/>
        </el-main>
        <el-footer></el-footer>
      </el-container>
    </el-container>
  </el-container>
</template>

<script>
export default {};
</script>

<style>
section {
  height: 100%;
}
.el-aside {
  background: #555c63;
}
.el-header {
   background: #555c63;
}
</style>