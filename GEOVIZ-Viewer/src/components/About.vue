<template>
  <div id="about-page">


  </div>
</template>

<script>
  export default {
    name: 'about',
    data: function () {
      return {

      }
    },
    mounted: function () {
      document.body.style.background = "rgb(236,245,255)"
      let statsMeter = document.getElementById("statsMeter")
      if (statsMeter) statsMeter.parentNode.removeChild(statsMeter);
    }
  }
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
#about-page {
  color: #1C1C1C !important;
}
</style>
