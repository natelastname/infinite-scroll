function main(){
    fs.calculateDimensions();

    let initial_pos = $("#navigator").position().top;
    let margin = 20;
    $("#nav-marker").css("left", margin);
    let width = $("#navigator").width()-margin;


    $(window).scroll(function(e){
        let elt = $('#navigator');
        let isPositionFixed = (elt.css('position') == 'fixed');
        if ($(this).scrollTop() > initial_pos && !isPositionFixed){
            elt.css({'position': 'fixed', 'top': '0px'});
        }
        if ($(this).scrollTop() < initial_pos && isPositionFixed){
            elt.css({'position': 'static', 'top': '0px'});
        }
    });

    gb.runnerScale = fs.linearScale([0, gb.count], [margin, width]);
    gb.percAxisScale = fs.linearScale([0, 100], [margin, width]);
    fs.renderSetupAxis();
    fs.renderPercentAxis();

    d3.select('#scrollbar .axis')
        .style("cursor", "pointer")
        .on("click", function(evt){
            let mouse = d3.pointer(evt);
            console.log(mouse);
            let click_n = gb.runnerScale.invert(mouse[0]);
            click_n = Math.min(Math.floor(click_n), gb.count);
            fs.currentPosition(click_n);

            console.log(click_n);
            return;
        });

    // images
    gb.columnLoop = fs.incrementLoop(gb.columns);
    gb.rowThrottle = fs.incrementThrottle(gb.columns);
    fs.createData();
    gb.linearScale = fs.linearScale([1, gb.rowCount * gb.containerHeight], [1, gb.rowCount]);
    fs.onscroll();

    $(document).keydown( function(event){
        // KP_6
        if (event.keyCode == '39'){
            // zoom out
            $('#images').empty();
            gb.columns += 1;
            fs.calculateDimensions();
            gb.columnLoop = fs.incrementLoop(gb.columns);
            gb.rowThrottle = fs.incrementThrottle(gb.columns);
            fs.createData();
            gb.linearScale = fs.linearScale([1, gb.rowCount * gb.containerHeight], [1, gb.rowCount]);
            fs.highlightImage();
            return;
        }
        // KP_4
        if (event.keyCode == '37'){
            // zoom in
            $('#images').empty();
            gb.columns -= 1;
            fs.calculateDimensions();
            gb.columnLoop = fs.incrementLoop(gb.columns);
            gb.rowThrottle = fs.incrementThrottle(gb.columns);
            fs.createData();
            gb.linearScale = fs.linearScale([1, gb.rowCount * gb.containerHeight], [1, gb.rowCount]);
            fs.highlightImage();
            return;
        }
    });
}

var gb = {
    // Total number of images
    count: 4096,
    data: [],
    columns: 3,
    rowCount: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    navigatorHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
    leftMargin: 0,
    containerBottomBorder: 1,
    columnLoop: null,
    rowThrottle: null,
    linearScale: null,
    runnerScale: null,
    percAxisScale: null,
    runnerColors: ['rb1', 'rb2', 'rb3', 'rb4'],
    colorPicker: null
}

var fs = {
    color: function(){
        d3.scaleOrdinal([`#000000`, `#9e9e9e`])
    },
    render: function(matches){
        var selection = d3.select('#images')
            .selectAll("div.image-container")
            .data(matches, function(o){ return o.id; });
        // enter
        var enter = selection.enter();
        var imageContainer = enter.append("div");
        imageContainer
            .attr("id", function(o) { return o.id; })
            .attr("class", "image-container")
            .style('width', gb.containerWidth - 1 + 'px')
            .style('height', gb.containerHeight - 1 + 'px')
            .style('top', function(o) { return o.calcTop(); })
            .style("left", function(o) { return o.calcLeft(); })
            .append('div')
            .text(function(o) { return o.val() })
            .attr('class', function(o) { return o.textClass() });

        let width_px = Math.floor($("#images").width()/gb.columns);
        let height_px = width_px;
        $(".image-container").css({"width": width_px+"px"})
        $(".image-container").css({"height": height_px+"px"})
        // update

        // exit
        selection.exit().remove();

        return;
    },

    image: function(id, row, column){
        var image = {
            id: id,
            row: row,
            column: column,
            top: null,
            left: null,
            src: fs.get_image_n(id),
            val: function() {
                return this.id;
            },
            calcTop: function() {
                this.top = (this.row * gb.containerHeight) + $("#navigator").height();
                return this.top + 'px';
            },
            calcLeft: function() {
                //this.left = (this.column) * gb.containerWidth + gb.leftMargin;
                this.left = (this.column * gb.containerWidth) + $("#images").position().left;

                return this.left + 'px';
            },

            imageLoaded: function(){
                // TODO: For what purpose???
                var self = this;
                fs.randomDelay(600, 1200, function(){
                    $('#' + self.id)
                        .empty()
                        .append('<img src="' + self.src + '" />')
                        .append('<span class="image-meta">' + self.src + '</span>');

                });
            },
            textClass: function() { return ''; }
        }

        return image;
    },
    highlightImage: function() {

        let width_px = Math.floor($("#images").width()/gb.columns);
        let height_px = width_px;
        $(".image-container").css({"width": width_px+"px"})
        $(".image-container").css({"height": height_px+"px"})

        //let scrollY = Math.max(0, window.scrollY - $("#images").position().top);
        var scrollY = window.scrollY + Math.floor(gb.viewportHeight / 2);
        let row = gb.linearScale(scrollY);
        console.log("==============================");
        console.log("ScrollY:"+scrollY);
        console.log("Row: "+row);

        // buffer rows should equal (number of rows in one viewport)
        // Change this to tweak how far ahead/behind it loads
        let buffer_rows = Math.floor(window.innerHeight / gb.containerHeight)*2;

        console.log("Buffer_rows: "+buffer_rows);

        let matches = [];
        for (let i = 0; i < gb.data.length; i++) {
            let item_row = gb.data[i].row;
            if ((item_row >= row-buffer_rows) && (item_row <= row+buffer_rows)){
                matches.push(gb.data[i]);
            }
        }

        let ids = matches.map(function(item){return item.id});
        let min_id = Math.min.apply(Math, ids);
        let max_id = Math.max.apply(Math, ids);

        let mid_id = Math.floor((min_id + max_id) / 2);

        fs.currentPosition(min_id);
        //fs.currentPosition(matches[0].id);
        fs.render(matches);
        for(var i = 0; i < matches.length; i++) {
            //matches[i].imageLoaded();
        }

        console.log("min_id:" + min_id);
        console.log("min_id:" + mid_id);
        console.log("max_id:" + max_id);

        //$(".image-container").css({"width": (100/gb.columns).toString() +"%" })
        //$(".image-container").css({"height": (100/gb.columns).toString() +"%" })
        //$("#images").css({"height": window.innerHeight+"px"})
        //$("#images").css({"displa"})
        return;
    },

    createData: function(){
        gb.data = [];
        for (var i = 1; i <= gb.count; i++){
            gb.data.push( fs.image(i, gb.rowThrottle(), gb.columnLoop()) );
        }
        gb.rowCount = ($("#images").width() / gb.columns)
        fs.bodyHeight(gb.rowCount * gb.containerHeight);
        return;
    },

    linearScale: function(domain, range){
        return d3.scaleLinear()
            .domain(domain)
            .rangeRound(range);
    },

    onscroll: function(){
        $(window).on('scroll', _.debounce(function(){
            console.log("Scroll");
            fs.highlightImage();
            return;
        }, 400));
        if (window.scrollY === 0){
            fs.highlightImage();
        }
        return;
    },

    calculateDimensions: function(){
        let width_percent = (100/gb.columns).toString() +"%";
        gb.containerHeight = $("#images").width() / gb.columns;
        gb.containerWidth = gb.containerHeight;

        console.log("("+gb.containerWidth+","+gb.containerHeight+")");
        gb.navigatorHeight = $('#navigator').height();

        let str = "1fr ".repeat(gb.columns)
        $("#images").css("grid-template-columns", str);
        $("#images").css("grid-template-rows", str);
        $("#images").css("height", window.innerHeight+"px");
        return;
    },

    bodyHeight: function(n) {
        $('#content').css('height', n + 'px');
        $('#menu').css('height', n + 'px');
        return;
    },

    incrementLoop: function(n){
        var n = n;
        var current = -1;
        return function(){
            current += 1;
            var c = current;

            if (current < n){
                var c = current;
            }
            else{
                current = 0;
                c = 0;
            }
            return c;
        }
    },
    incrementThrottle: function(n){
        var n = n,
            current = 0,
            count = 0;
        return function(){
            if (count < n){
                count +=1;
            }
            else{
                count = 1;
                current += 1;
            }
            return current;
        }
    },
    randomDelay: function(min, max, f){
        window.setTimeout(f, fs.getRandomInt(min, max));
        return;
    },
    get_image_n: function(n){
        // TODO: Put code here
        return "pic1.png";
    },
    getRandomInt: function(min, max){
        return Math.floor(Math.random() * (max - min)) + min;
    },
    range: function(min, max){
        return d3.range(min, max + 1);
    },
    renderPercentAxis: function(){
        let svg1 = d3.select('#scrollbar')
            .append('svg')
            .attr('class', 'axis');
        let axisBottom = d3.axisBottom(gb.runnerScale)
            .ticks(20)
            .tickPadding(10);
        svg1.append("g")
            .attr('id', 'navbarpath')
            .style("cursor", "pointer")
            .call(axisBottom);
        d3.selectAll('#scrollbar text')
            .style('fill', '#000000')
            .style('font-size', '10');

        let tickValues = [];
        for (var i = 0; i <= 10; i++){
            tickValues.push( (i*10) *  gb.count / 100 );
        }

        let svg2 = d3.select('#percentage')
            .append('svg')
            .attr('class', 'axis');
        let axisTop = d3.axisBottom()
            .scale(gb.runnerScale)
            .tickValues(tickValues)
            .tickFormat(function(v, i) {
                let value = i*10;
                return value.toString()+"%";
            });
        svg2.append("g").call(axisTop)

        d3.select('#percentage path').remove();
        d3.selectAll('#percentage line').remove();
        d3.selectAll('#percentage text')
            .style('fill', '#000000')
            .style('font-family', 'Verdana')
            .style('font-size', '10');




        return;
    },
    renderSetupAxis: function(){

    },
    currentPosition: function(n){
        var left = gb.runnerScale(n);
        d3.select('#nav-marker')
            .transition().duration(500)
            .style('left', left + 'px');
        return;
    },
    percClick: function(tickVal, index){
        var datum;
        for (var i = tickVal; i < gb.data.length; i++){
            if (gb.data[i].id === tickVal){
                datum = gb.data[i];
                break;
            }
        }
        var scale = fs.linearScale([0, gb.rowCount], [0, gb.rowCount * gb.containerHeight]);
        var y = scale( datum.row - 1 );
        window.scrollTo(0, y);
        return;
    },
    randomItemDedup: function(arr){
        var a = arr;
        var last = null;
        return function (){
            var ret;
            while (true){
                ret = a[Math.floor(Math.random() * (a.length - 0)) + 0];
                if (ret != last){
                    break;
                }
            }
            last = ret;
            return ret;
        }
    },
    randomItem: function(arr){
        return arr[fs.getRandomInt(0, arr.length)];
    },
    removePx: function(str) {
        if ( str.slice(str.length - 2) === 'px' ){
            return str.slice(0, str.length - 2);
        }
        return str;
    }
}
$(document).ready(main);
