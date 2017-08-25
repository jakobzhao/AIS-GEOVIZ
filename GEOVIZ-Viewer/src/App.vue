<template>
  <div id="app">
<!--    <el-menu theme="dark" :default-active="activeIndex2" class="el-menu-nav" mode="horizontal" @select="handleSelect">
      <el-menu-item index="1">GEOVIZ AIS Visualization</el-menu-item>
      <el-menu-item index="3">
        <a href="#" target="_blank">About</a>
      </el-menu-item>
    </el-menu>-->
    <router-view></router-view>
  </div>
</template>

<script>
  export default {
    name: 'app'
  }
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
  @import url('https://fonts.googleapis.com/css?family=Ubuntu');
  #app {
    font-family: 'Ubuntu', Helvetica, Arial, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
</style>
