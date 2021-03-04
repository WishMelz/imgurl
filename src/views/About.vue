<template>
  <div>
    <h1>使用步骤</h1>
    <p>
      创建一个图床仓库 --> 设置一个版本(Releases) --> 拿到github的token秘钥 -->
      在项目中配置好 --> 上传文件
    </p>
    <h3>创建一个图床仓库</h3>
    <p>创库创建完成之后设置新建一个Releases</p>
    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/repo1.png"
      alt="img"
      style="zoom: 50%"
    />

    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/repo2.png"
      alt="img"
      style="zoom: 33%"
    />

    <p>随便输入一个版本号，回车即可！！！</p>

    <h3>首先拿到TOKEN</h3>
    <p>
      1.打开链接
      <a target="_blank" href="https://github.com/settings/tokens"
        >https://github.com/settings/tokens</a
      >
      点击 Generate new token 按钮
    </p>
    <p>
      2.在打开的 <b>New personal access token</b> 中选中"repo"和"user",如下所示
    </p>
    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/getToken.png"
      alt=""
    />
    <p>3.然后点击 Generate token 按钮，即可生成一个token，如下：</p>
    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/token.png"
      alt=""
    />
    <p style="color: red"><em>​ 生成的TOKEN只会显示一次。记得保存！！</em></p>
    <h3>使用</h3>
    <p>先设置用户token和仓库路劲</p>

    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/set.png"
      alt="img"
      style="zoom: 50%"
    />

    <p>使用</p>

    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/0f0765da7cbf3fbd482134d06a13d822.png"
      alt="img"
      style="zoom: 50%"
    />

    <p>列表</p>

    <img
      src="https://cdn.jsdelivr.net/gh/WishMelz/file/image/4af4a12a816480b138bbd2ea27871438.png"
      alt="img"
      style="zoom: 50%"
    />
  </div>
</template>

<script>
export default {};
</script>

<style scoped>
</style>