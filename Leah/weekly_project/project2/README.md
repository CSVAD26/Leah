# When Do I Photograph?

A personal photo time diary made with p5.js, HTML, CSS, and local Python data-processing tools.

## Intention

I almost always carry my phone with me, and I use it to take photographs throughout my daily life. It becomes so accessible that taking pictures has become part of my automatic action whenever I want to document. My intention was to understand when I tend to capture the moment and which parts of my daily routine appear in my photographs. For this project I wanted to understand **When am I most inclined to take photographs?** and analyze my habits in a given time range from 2019-2026. This project uses the timestamps of my photos to explore that question across hours, weekdays, and years.

The result is a visual diary displaying timely patterns of my photography. The current dataset contains **41,487 photographs from 2019 through 2026**. Looking at their distribution helps me recognize patterns that are difficult to notice while scrolling through a photo library. The project connects a familiar creative activity with a less visible record of my routines and photography-related phone use.

## Functionality

The page presents five graphs in this order:

1. **Navigate time (`navigate-time.js`).** A zoomable graph shows one dot per photograph, colored by year. With a local timestamp CSV loaded, the x-axis shows capture time of day and the y-axis shows the running photo count within each hour, ordered by capture date. Zooming out reveals clusters; zooming to 6× or closer reveals individual timestamp labels. Drag to pan, and hover or click a dot to inspect its details. The points remain fixed while the viewer navigates.
2. **Total photographs by hour.** A bar chart groups photographs into 24 capture hours, from 00 through 23. The vertical axis shows the number of photographs. The year selector switches between one year and the complete collection.
3. **Average photographs by hour.** A line and shaded area show the average number of photographs per calendar day at each hour. Each hourly total is divided by the calendar days covered by the selected range, including days without photographs between the first and last imported dates. Hovering reveals an hourly average. This chart has the same shape as the total chart because all 24 values share one denominator, but its vertical scale expresses a daily rate.
4. **Photographs by weekday.** Seven bars show Monday through Sunday, with counts above the bars. Pink highlights identify the busiest weekday, including all tied days. This chart follows the year selector.
5. **Year-by-hour heatmap.** Rows represent years and columns represent hours. Hovering reveals the year, hour, and exact photo count. In the current calculation, color intensity represents an hour's share of that year's photographs; the hover value gives the absolute count. The heatmap keeps all years visible while the other graphs follow the year selector.

The default opening view uses the exported hourly totals. Choose **Load timestamp CSV** and select `photo_times_private.csv` to see exact capture times and dates. For privacy, this file stays in browser memory and is not uploaded or saved by the page. Without it, dots are grouped by hour and labels show the year, hour, and display number. The four summary charts continue to use the exported dataset. **Use exported data** clears the imported timestamps. All times are camera-local.

## Design principles

I wanted the interface to support comparison without distracting from the personal question behind the data. A light background, matching graph headings, aligned plotting areas, and repeated hour labels make the charts easier to read together. Blue connects the hourly views and the heatmap, while pink draws attention to the busiest weekday. Counts, axis labels, and hover text provide numerical detail alongside the visual patterns.

The interaction is straightforward: choosing a year updates the relevant charts, and hovering reveals values that would clutter the page if every number were permanently displayed. On narrower screens, some hour labels are spaced farther apart and weekday names are shortened. The canvas uses the display's pixel density to keep text and lines sharper on high-resolution screens.

Privacy is another design principle. The shared visualization contains aggregate counts and calendar-day coverage totals. Original images, filenames, GPS information, and individual capture timestamps remain outside the website. This lets the project communicate patterns without exposing the contents of my photo library.

## Process

I first organized the capture-time metadata into a consistent structure. My JSON workflow uses `private-data/clean-metadata.py` to read `photo-times.json`, parse valid timestamps, extract dates and hours, and produce `photo_times_private.csv`. An alternative tool, `private-tools/analyze.py`, can extract capture times directly from locally exported image files. Both routes produce a private CSV that the exporter can read.

Next, `private-tools/export_to_p5.py` groups the records by year and hour, derives Monday-to-Sunday counts from the capture dates, and calculates calendar-day coverage. It writes these aggregates into the marked data block in `submission/sketch.js`. Separating processing from drawing allows the browser to run the project without loading private timestamp records or processing original photographs.

I developed the visualization in stages. I started with hourly totals, then added daily averages to make the scale easier to interpret. The weekday chart introduced another way of examining routines, and the heatmap made it possible to compare years together. I refined the axes, added hover values, matched the headings, and moved the heatmap to the bottom. These changes taught me that presentation details affect whether a visualization is understandable, even when its underlying numbers are correct.

I then added the opening graph in `submission/navigate-time.js` to explore individual records alongside the summaries. I tried an attractor-like arrangement with moving dots, but the movement did not have a clear relationship to when I took photographs. I revised the layout so that a photo's time of day and its place in the hourly count determine its position. Zooming changes the level of detail: the same collection can be read as clusters at a distance and as timestamp text up close. I also separated local timestamp loading from the public aggregates so that this more detailed view does not require publishing individual capture dates.

## Reflections

Looking at the graphs made me more aware of how often I have been staying up late over the past few years. The photos taken late at night and after midnight reflect moments when I was still awake and using my phone's camera. When I scroll through my photo library, I usually focus on what is in each picture or the memory behind it. Seeing those same photos organized by time helped me notice a part of my routine that I would normally overlook.

The graphs also helped me think about how my phone fits into my daily life. Since I almost always carry it with me, taking a photo is one of the ways I use my phone throughout the day. These timestamps give me a record of that activity, including during late-night hours. They only capture moments when I took photographs, though. I also use my phone without taking pictures, so the graphs cannot show my total screen time or tell me exactly when I went to sleep. I see them as a way to reflect on my habits alongside what I already know about my sleep schedule.

I also found it interesting that the afternoon was my busiest time for photography overall, even though the late-night photos stood out to me personally. This helped me understand that different parts of the data can reveal different aspects of my routine. Comparing hours, weekdays, and years lets me explore those patterns instead of focusing only on the highest bar. I also need to consider how travel, missing photos, or taking many pictures during one event might affect the results. The project has encouraged me to ask more questions about the connection between my photography habits and my everyday life.

The Navigate time graph gives me a closer look at patterns that the hourly bars summarize. From a distance, I can compare the dense and sparse parts of the day. After loading the timestamps and zooming in, I can see where photographs fall within an hour, including whether they were taken near its beginning or end. The year colors help me compare activity from different years in the same area of the graph. This lets me move between a broad view of my routine and the individual moments behind it.

This detail also changes how I interpret a cluster. A large number of photographs could come from taking many pictures on one occasion or returning to the camera at a similar time on different days. Inspecting the dates helps me explore that difference instead of assuming that every dense area represents a regular habit. For the late-night photographs, I can look at specific timestamps alongside my own memories of those periods. The graph gives me more questions to ask about my sleep schedule and phone use, while reminding me that the number of photographs does not measure how long I used my phone. Keeping the points aligned with their recorded times makes that exploration easier to follow.

## Outcomes and next steps

In the current collection, **16:00-16:59 is the busiest hour, with 3,927 photographs**. About **51.4%** of the photographs fall between noon and 18:00. **Saturday is the busiest weekday, with 7,796 photographs**, followed by Sunday with 7,398. There are also 1,764 photographs captured between midnight and 06:00, approximately 4.3% of the total. These findings give me concrete starting points for thinking about photography, phone use, and the rhythm of my days.

The outcome is an interactive diary that makes a large personal collection easier to question. I can identify my busiest hours, compare weekday patterns, and look for changes across years. The project gives me a way to connect an everyday creative habit with my own experience of time, sleep, and phone use. It also helped me understand why the units and comparisons in a visualization matter: a total, a daily average, and a within-year share each describe a different aspect of the collection. Future development could include a “Guess my busiest hour” petal-clock opening, separating photography sessions from bursts of individual images, and comparing two years directly.

## How to run the project

### View the existing visualization

You need Python 3 and a web browser. The website uses aggregate data already embedded in `submission/sketch.js`; viewing it does not require private data or Python image-processing packages.

1. Download or clone the repository and open this project's folder, `Leah/weekly_project/project2`, in a terminal. If you already have the project open in your editor, open its terminal in the `project2` folder. The `submission/` folder must be present locally.
2. Confirm that `submission/library/` contains `p5.min.js` and `p5.sound.min.js`, matching the script paths in `submission/index.html`.
3. Run this command from the project folder:

   ```sh
   python3 -m http.server 8000 --directory submission
   ```

4. Open [http://localhost:8000](http://localhost:8000) in your browser.
5. Explore the opening graph using the instructions below, choose a year, and scroll to compare all five graphs. Hover over the average chart and heatmap to see exact values.
6. Press `Control+C` in the terminal to stop the server.

There is no npm installation or build step. `submission/index.html` loads the local p5.js libraries, stylesheet, and sketch.

### How to use the first graph: Navigate time

1. **Start with the overview.** The first graph displays one dot per photograph using the existing aggregate data. Colors correspond to the years listed below the graph. Select **All years** or an individual year using the page's year selector.
2. **Load timestamps for a detailed view.** Click **Load timestamp CSV** and choose `private-data/photo_times_private.csv` from your computer. This enables exact time-of-day positions and full timestamp labels. The CSV stays in the browser tab; it is not sent to a server. The graph accepts the `taken_at` column produced by the JSON-cleaning script, the `timestamp` column produced by the image-analysis script, or separate `date` and `time` columns.
3. **Zoom into a cluster.** Scroll over the graph or use the **+** and **−** buttons. Mouse-wheel zoom centers on the pointer. At 6× zoom and above, timestamp strings appear beside points where they fit. Overlapping labels are omitted for readability; zoom closer or inspect a particular dot to see its details.
4. **Move around.** Drag the graph to pan. On a touch screen, drag to pan and pinch to zoom. For keyboard navigation, focus the canvas by clicking it or pressing Tab, then use **+**, **−**, and the **arrow keys**.
5. **Inspect a photograph.** Hover over a dot for its tooltip or click it to keep its details in the text below the graph. The horizontal axis shows capture time of day. The vertical axis shows the photo's running count within its hour, so a higher point was captured later within that hourly group. It does not show elapsed time or the duration of phone use.
6. **Return to an overview.** Click **Reset view** or press **0** while the canvas is focused. To remove the locally loaded timestamps and return to the aggregate-only view, click **Use exported data**. Refreshing the page also clears the imported data.
7. **Compare with the summaries.** Click **Explore the summary charts** or scroll down to the hourly totals, daily averages, weekday totals, and yearly heatmap. These views help place an individual timestamp in the context of the wider collection.

### Update the data locally

These optional steps require the author's local processing tools and private source data. Choose one input route, since both routes write the same CSV file.

**From JSON metadata:** place the JSON list of photo records in `private-data/photo-times.json`. Each record needs a valid ISO-format `taken_at` timestamp. Then run:

```sh
python3 private-data/clean-metadata.py
python3 private-tools/export_to_p5.py
```

**From original image files:** export the originals to a local folder outside `submission/`. Set up a virtual environment and install the image-reading packages:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install Pillow pillow-heif
python private-tools/analyze.py --source /path/to/exported/photos --out private-data
python private-tools/export_to_p5.py
```

Replace `/path/to/exported/photos` with the actual folder path. Refresh the browser after exporting. Keep the `// DATA_START` and `// DATA_END` markers in `sketch.js`, because the exporter replaces only the data between them.

## Project files and privacy

| Path | Purpose |
| --- | --- |
| `README.md` | Project description, process, reflections, findings, and execution instructions. |
| `submission/index.html` | Page structure and library loading. |
| `submission/sketch.js` | Aggregate data, drawing, filtering, and hover interactions. |
| `submission/navigate-time.js` | Time-aligned photo dots, local CSV parsing, timestamp labels, and mouse, touch, and keyboard navigation. |
| `submission/style.css` | Page layout, colors, and responsive styles. |
| `submission/library/` | Local p5.js and p5.sound libraries. |
| `submission/jsconfig.json` and `submission/p5-globals.d.ts` | Editor type-checking support; no build step is required. |
| `private-tools/` | Local metadata extraction and aggregate-export scripts. |
| `private-data/` | Local JSON, individual timestamp records, and metadata-cleaning script. |

The shareable project consists of this README and `submission/`. Keep `private-data/`, `private-tools/`, exported originals, and `.venv/` out of the public submission. The `.gitignore` file excludes private data and the virtual environment. Serve `submission/` as the website root.

The exporter currently accepts capture years from 2019 through 2026. It uses camera-local dates and hours without converting all records to a common time zone. Counts represent photographs, including multiple images taken during the same occasion. These choices define what the charts can show and should be considered when interpreting the results.
