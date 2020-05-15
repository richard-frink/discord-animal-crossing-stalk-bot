# Mike Koogle
# May 15, 2020
# I hope Covid-19 is over for you, future reader.

from flask import Flask, request
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os
import time

app = Flask(__name__)
buzzwords = ["Decreasing", "Fluctuating", "Large Spike", "Small Spike"]

chrome_options = Options()
chrome_options.add_argument("--headless")
chrome_options.add_argument("--window-size=1024x1400")

# download Chrome Webdriver
# https://sites.google.com/a/chromium.org/chromedriver/download
# put driver executable file in the script directory
chrome_driver = os.path.join(os.getcwd(), "chromedriver")
driver = webdriver.Chrome(options=chrome_options, executable_path=chrome_driver)

@app.route('/')
def hello():
    name = request.query_string.decode("utf-8")
    print(name)
    return be_redirect(name)

def be_redirect(my_query):
    pattern_nets = dict.fromkeys(buzzwords, 0.0)

    # driver.get("http://0.0.0.0:8000/?prices=101.91.87.82.78........&pattern=1")
    query_string = "https://turnipprophet.io/?" + my_query
    driver.get(query_string)
    assert "Animal Crossing - Turnip Prophet".lower() in driver.title.lower()

    # There's a cleaner way to wait, but hey. It's a second.
    time.sleep(1)

    # Get chart
    all_patterns = driver.find_element_by_id("output").text.split('\n')
    found_patts = []
    for patt in all_patterns:
        # Just count the rows with the net percentages in them
        for buzz in buzzwords:
            if patt.count(buzz) > 0:
                if buzz in found_patts:
                    break
                else:
                    found_patts.append(buzz)
                snip = patt[(len(buzz)+1):patt.index("%")]
                # print(snip)
                pattern_nets[buzz] += float(snip)

    # print(pattern_nets)
    outstring = ""
    for buzz in buzzwords:
        outstring += '| ' + str(round(pattern_nets[buzz]))[:3]

    # print(outstring)
    return outstring

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5011)