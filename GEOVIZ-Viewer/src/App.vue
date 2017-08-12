<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
  export default {
    name: 'app'
  }
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
  @import url('https://fonts.googleapis.com/css?family=Ubuntu:500');
  #app {
    font-family: 'Ubuntu', Helvetica, Arial, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
</style>
