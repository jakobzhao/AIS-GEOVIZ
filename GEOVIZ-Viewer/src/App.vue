<template>
  <div id="app">
    <el-menu theme="dark" default-active="1" class="el-menu-nav" mode="horizontal">
      <el-menu-item index="0">
        <span id="site-name">GeoVIZ AIS Vessel Visualization</span>
      </el-menu-item>

      <div class="nav-container">
        <div class="nav-menu">
          <router-link to="/">
            <el-menu-item index="1">
              <span>Home</span>
            </el-menu-item>
          </router-link>

          <router-link to="/about">
            <el-menu-item index="2">
              <span>About</span>
            </el-menu-item>
          </router-link>
        </div>

        <div class="share-button-group">
          <div>
            <a href="https://github.com/jakobzhao/AIS-GEOVIZ" target="_blank">
              <img src="../src/assets/GitHub-Mark-Light-32px.png" alt="" style="height: 22px; width: auto; margin-top: 2px">
              <span>GitHub</span>
            </a>
          </div>

          <iframe
            :src="twitterSrc"
            width="80"
            height="37"
            title="Twitter Tweet Button"
            style="border: 0; overflow: hidden;">
          </iframe>

          <iframe src="https://www.facebook.com/plugins/share_button.php?href=http%3A%2F%2Fgeoviz.geotricks.net%2F&layout=button_count&size=large&mobile_iframe=true&width=85&height=37&appId" width="85" height="37" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true"></iframe>
        </div>
      </div>


    </el-menu>
    <router-view></router-view>


  </div>
</template>

<script>
  export default {
    name: 'app',
    data: function () {
      return {
        siteURL: encodeURI('http://geoviz.geotricks.net/'),
        siteDescription: encodeURI('A WebGL-backed AIS Visualization'),
        siteHashtags: encodeURI('60kVessels, WebGL')
      }
    },
    computed: {
      twitterSrc: function () {
        return 'https://platform.twitter.com/widgets/tweet_button.html?size=l&url=' + this.siteURL + '&text=' + this.siteDescription + '&hashtags=' + this.siteHashtags
      }

    }
  }
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
  @import url('https://fonts.googleapis.com/css?family=Ubuntu');

  #app {
    font-family: 'Ubuntu', Helvetica, Arial, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .el-menu {
    background-color: #23799C !important;
    span {
      text-decoration: none !important;
      font-size: 1.2em;
      font-weight: bold;
      color: white;
    }

    #site-name {
      font-size: 2em;
    }

    .nav-container {
      float: right;
      display: flex;
    }

    .share-button-group {
      display: flex;
      justify-content: space-around;
      width: 280px;
      margin-top: 5px;
      padding: 0 3em;
      a {
        text-decoration: none;
        color: white;
        span {
          font-weight: bold;
        }
      }
    }
  }


</style>
