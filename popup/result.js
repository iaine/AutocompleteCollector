const back = browser.extension.getBackgroundPage();

function fetchData (platform) {
    return getSite(platform);
}

function button_handler(event) {

    if (event.target.matches(".select")) {
      platform = event.target.getAttribute("data-attribute")
      console.log (fetchData(platform));
    } else if (event.target.matches(".remove")) {
      platform = event.target.getAttribute("data-attribute")
      try {
         deleteSite(platform);
      } catch (error) {
        console.error(error);
      }
     
    }
}


/**
 * Init!
 */
document.addEventListener('DOMContentLoaded', async function () {
    document.addEventListener('click', button_handler);
});