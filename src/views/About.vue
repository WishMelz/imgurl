<template>
  <div>
    <el-steps :active="active" finish-status="success" align-center>
      <el-step title="第一步：创建一个GitHub仓库" description="">123</el-step>
      <el-step title="第二步：拿到GitHub的Token">33</el-step>
      <el-step title="第三步：使用">555</el-step>
    </el-steps>
    <div class="cont">
      <Step1 v-if="active == 0"></Step1>
      <Step2 v-if="active == 1"></Step2>
      <Step3 v-if="active == 2"></Step3>
      <div v-if="active == 3">
        <h2>OK！恭喜你完成使用教程！</h2>
        <p> <el-link href="https://github.com/WishMelz" type="primary"> 作者： WishMelz</el-link></p>
        <p>
          <el-link href="https://github.com/WishMelz/imgurl" type="primary"> 仓库地址： https://github.com/WishMelz/imgurl 欢迎点赞</el-link>
        </p>
      </div>
    </div>
    <div style="text-align: center; padding-top: 20px">
      <el-button type="primary" @click="next(2)">上一步</el-button>
      <el-button type="primary" @click="next(1)">下一步</el-button>
    </div>
  </div>
</template>

<script>
import Step1 from "@/components/Step1";
import Step2 from "@/components/Step2";
import Step3 from "@/components/Step3";
export default {
  components: {
    Step1,
    Step2,
    Step3,
  },
  data() {
    return {
      active: 0,
    };
  },
  methods: {
    next(type) {
      if (type == 1) {
        if (this.active == 3) {
          return;
        }
        this.active++;
        if (this.active == 3) {
          this.$message.success("恭喜你完成配置");
        }
      } else {
        if (this.active == 0) {
          return;
        }
        this.active--;
      }
    },
  },
};
</script>

<style scoped>
.cont {
  text-align: center;
  padding-top: 30px;
}
</style>