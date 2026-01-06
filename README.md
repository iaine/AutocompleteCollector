## Autocomplete Reader

This is a Firefox plugin to read the autocomplete responses from search engines

Currently only Google, DuckDuckGo, Yandex, and Baidu are covered.

The plugin uses the WebRequest API to record queries. Data is stored in your browser. 

### Usage

Install the plugin into Firefox. 

Open a new tab with the search engine to be tested. 

Query the autocomplete. 

Click open the plugin. 

Click select against the desired engine to get data or delete to remove it. 

A CSV will be downloaded with the headings:

collected - the time collected
siteurl - the engine used
query - the query
suggestions - the suggestions separated by ;
extra information - any extra information separated by ;

### Issues, Features, and Bugs

This is research software on a moving set of platforms. Things are likely to change. 

Please do raise bugs and issues on the Github issue tracker.

### Roadmap

There are hopes to expand this with other features as and when.

One is to track if working in AI mode at all. 