"use strict"

var app = new Vue({
  el: "#main",
  data: {
    showTags: false,
    // workbook information about the target spreadsheet
    workbook: {
      // spreadsheet ID
        id: "1DfyPFkE8FZS8fdQrp0eKXmjPG51RMdZ6mkScHcsHiF0",
    //   id: "1ZNVF9u4MuQ5MLu3oxAhIBqZWhEI84igOQcKLDy43x3U", // original sheet
      // The SheetID for the workbook's sheets
      // See http://damolab.blogspot.com/2011/03/od6-and-finding-other-worksheet-ids.html
      // This can be a string OR the numbered position of the tab on the
      // workbook starting with 1 as the left most tab... yeah it's crazy
      sheets: {
          directory: 'od6',
      }
    },
    filter: {
      skills: {}
    },
    spreadsheet: [],
    cacheLifttime: 5*60*1000, //minutes*60*1000
    loaded: false,
    map: false
  },

  /**
   * On creation run method getData
   */
  created: function () {
    this.getData();
  },

  // Vue methods
  methods: {
    /**
     * Loops through this.workbook.sheets to fetch data
     * @return {[type]} [description]
     */
    getData: function () {
      var fresh = new URL(window.location.href).searchParams.get('fresh')

      for ( var i in this.workbook.sheets ) {
        var index = this.workbook.sheets[i];
        // cache based on workbook id
        if ( fresh || ! this.getCache( this.workbook.id, index )) {
          this.fetchData( this.workbook.id, index );
        }
      }
    },
    /**
     * fetches data from google via xhr
     * onload places data into cache
     * @param  {string} id    the spreadsheet ID
     * @param  {string} index the sheet id
     * @return none
     */
    fetchData: function ( id, index ) {
      var xhr = new XMLHttpRequest(),
          self = this,
          url = 'https://spreadsheets.google.com/feeds/list/' + id +  '/' + index + '/public/values?alt=json';
      xhr.open('GET', url )
      xhr.onload = function() {
          console.log('data loaded from xhr');
        self.putData( xhr.responseText, index );
        self.putCache( xhr.responseText, id, index );
      }
      xhr.send(null)
    },
    /**
     * Add's data to vue instance
     * Vue's $set method: https://vuejs.org/v2/api/#vm-set
     * @param  {string} data  the JSON string of data
     * @param  {string} index sheet id
     * @return none - uses vue's $set method to update data
     */
    putData: function ( data, index) {
      this.$set(this.spreadsheet, index, JSON.parse( data ));
      this.loaded = true;
    },
    /**
     * Adds data to local storage cache
     * @param  {string} data  JSON string of data
     * @param  {string} id    spreadsheet id (for identification)
     * @param  {string} index sheet id (for identification)
     * @return none
     */
    putCache: function ( data, id, index ) {
      var identity = id + index;
      window.localStorage.setItem( identity , data );
      console.log('data cached');
    },
    /**
     * gets data from the local storage cache
     * @param  {string} id    spreadsheet id
     * @param  {string} index sheet id
     * @return {bool}         true if data is present, false otherwise
     */
    getCache: function ( id, index ) {
      var identity = id + index;
      if ( window.localStorage.getItem( identity ) && this.cacheIsFresh() ) {
        this.putData( window.localStorage.getItem( identity ), index )
        console.log('data loaded from cache');
        return true;
      }

      return false;

    },
    /**
     * tests for cache "setupTime" and if it is expired
     * if there is no "setupTime" current time is added to local storage
     * see vue data "catchLifetime" for cache timeout
     * @return {bool} true if cache is fresh, false otherwise
     */
    cacheIsFresh: function () {
      var now = new Date().getTime();
      var setupTime = localStorage.getItem('setupTime');
      if (setupTime == null) {
          localStorage.setItem('setupTime', now);
          return false; // cache is NOT fresh
      } else {
          if(now - setupTime > this.cacheLifttime) {
              localStorage.clear()
              localStorage.setItem('setupTime', now);
              console.log('cache reset');
              return false; // cache is NOT fresh
          }
          return true; // cache is fresh
      }
    },
    /**
     * strips the http and www from a url
     * @param  {string} url a full URL for website
     * @return {string}     a url without the http and www
     * @TODO gracefull fail if url is null
     */
    stripHTTP: function ( url ) {
      var regex = new RegExp('(https?://(?:www.)?)','gi');
      return url.replace( regex, '' )
    },
    /**
     * Removes the trailing slash from a string
     * @param  {string} str string ready to have it's slash removed
     * @return {return}     string, now without a slash
     * @TODO gracefull fail if str is null
     */
    stripSlash: function ( str ) {
      return str.replace(/\/$/, "");
    },
    /**
     * Makes a URL pretty to look at
     * @param  {string} url a website url
     * @return {string}     a now pretty to look at url
     */
    prettyLink: function ( url ) {
      return this.stripSlash( this.stripHTTP( url ) );
    },
    /**
     * cleans up links to prevent bad things coming from user input
     * @param  {string} url The raw url
     * @return {string}     the clearned up url, if input is false, pass it through
     */
    sanitizeLink: function ( url ) {

      return (url) ? '//' + this.prettyLink( url ) : url ;
    },
    /**
     * Loops through Google Spreadsheet data and returns array of objects
     * constructed from callback
     * @param  {string}   index   the string reference for the workbook sheet
     * @param  {function} action  a function which passes row data and vue object
     * @return {array}            array of row data, false if sheetID doesn't exist
     */
    gsxRowObject: function ( index, action ) {
      if ( this.spreadsheet[index] === undefined ) return false;
      var out  = [],
          rows = this.spreadsheet[index].feed.entry,
          self = this;

      for (var i = 0; i < rows.length; i++) {
        out.push( action( rows[i], self ));
      }

      return out;
    },
    /**
     * Gathers Google Spreadsheet cell data for a particular column
     * @param  {object} row data row from Google Spreadsheet object
     * @param  {string} col name of spreadsheet column to fetch
     * @return {string}     returns cell data, null if cell contains no data
     */
    gsxGetCol: function ( row, col ) {
        var cell = row['gsx$' + this.gsxStripCol(col) ];
      return ( cell && cell.$t ) ? cell.$t : null ;
    },
    gsxStripCol: function( col ) {
        return col.toLowerCase().replace(/\s+/g, '');
    }, 
    toggleFilter: function ( subject, item ) {
      var filter = this.filter[subject];
      if ( filter[item.slug] ) {
        this.$delete(filter, item.slug)
      } else {
        this.$set(filter, item.slug, item)
      }
    }

  },

  watch: {
  },

  computed: {
    /**
     * Generates an edit link to the Google Spreadsheet
     * @return {string} url to spreadsheet
     */
    workbookEditURL: function () {
      return 'https://docs.google.com/spreadsheets/d/' + this.workbook.id + '/edit';
    },
    /**
     * Creates a cleaned up array of row data objects
     * from the freelancer-directory sheets data
     * the string passed into gsxGetCol corrisponds to the column header
     * on the spreadsheet, lower case and without spaces
     * @return {array} array of objects
     */
    locations: function () {
      return this.gsxRowObject( this.workbook.sheets.directory , function (r,self) {
            // var fullname = self.gsxGetCol( r, 'name'),
            //     skills = self.gsxGetCol( r, 'otherskills');


          return { //@TODO autmatically return
              name: self.gsxGetCol(r, 'Pantry name'),
              status: self.gsxGetCol(r, 'operatingstatus0316'),
              open: self.gsxGetCol(r, 'expectedopenorclosedates'),
              delivery: self.gsxGetCol(r, 'pickupdeliveryoptions'),
              phone: self.gsxGetCol(r, 'phone'),
              addressFull: self.gsxGetCol(r, 'fulladdress'),
              address: self.gsxGetCol(r, 'address'),
              city: self.gsxGetCol(r, 'city'),
              zip: self.gsxGetCol(r, 'zip'),
              hours: self.gsxGetCol(r, 'hoursofoperation'),
              services: self.gsxGetCol(r, 'servicesprovided'),
              lat: self.gsxGetCol(r, 'Latitude'),
              lon: self.gsxGetCol(r, 'Longitude'),
          }
        });
    }
  },
});

function slugify(text){
  return text.toString().toLowerCase().trim()
    .replace(/[^\w\s-]/g, '') // remove non-word [a-z0-9_], non-whitespace, non-hyphen characters
    .replace(/[\s_-]+/g, '_') // swap any length of whitespace, underscore, hyphen characters with a single _
    .replace(/^-+|-+$/g, ''); // remove leading, trailing -
}
