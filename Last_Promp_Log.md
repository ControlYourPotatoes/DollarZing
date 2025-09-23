Ok i am looking to work on this workflow nodes, i am looking to have some new behavior with layers, The closes I can reference is a sunburst graph that has some additional Layer and segment of choices, but i have some very custom data and need some creative suggestions on how to use, I know I have some tuned data ment for this nodes but that was done before planning the ui so things were asumed a lot, and could be modified for a more curated expirience but i want to see you recomended after glansing throught the datasets 

/workspace/engine/generated-datasets

After that, i was considering have 2 layers on the node, with onhover states.  Considering this has the 3x3x3 parameter combination , iwas thinking that for the most part the comparison should be done with the base, as the base or worse case scenerio still makes a lot of money and the comparison are to show better scenerios. so two layers of mid and high, Other charts will show comparison different so lets focus on the nodes being this custom svg. Do we install nivo and just use theirs? I will show you their sample
import { ResponsiveSunburst } from '@nivo/sunburst'

const MySunburst = ({ data /* see data tab */ }) => (
    <ResponsiveSunburst /* or Sunburst for fixed dimensions */
        data={data}
        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        cornerRadius={2}
        borderColor={{ theme: 'background' }}
        enableArcLabels={true}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 1.4]] }}
    />
)
{
  "id": "nivo",
  "children": [
    {
      "id": "viz",
      "children": [
        {
          "id": "stack",
          "children": [
            {
              "id": "cchart",
              "value": 158716
            },
            {
              "id": "xAxis",
              "value": 112378
            },
            {
              "id": "yAxis",
              "value": 175381
            },
            {
              "id": "layers",
              "value": 136829
            }
          ]
        },
        {
          "id": "ppie",
          "children": [
            {
              "id": "chart",
              "children": [
                {
                  "id": "pie",
                  "children": [
                    {
                      "id": "outline",
                      "value": 179341
                    },
                    {
                      "id": "slices",
                      "value": 121705
                    },
                    {
                      "id": "bbox",
                      "value": 181549
                    }
                  ]
                },
                {
                  "id": "donut",
                  "value": 25198
                },
                {
                  "id": "gauge",
                  "value": 174389
                }
              ]
            },
            {
              "id": "legends",
              "value": 42521
            }
          ]
        }
      ]
    },
    {
      "id": "colors",
      "children": [
        {
          "id": "rgb",
          "value": 39689
        },
        {
          "id": "hsl",
          "value": 86129
        }
      ]
    },
    {
      "id": "utils",
      "children": [
        {
          "id": "randomize",
          "value": 148037
        },
        {
          "id": "resetClock",
          "value": 23008
        },
        {
          "id": "noop",
          "value": 9177
        },
        {
          "id": "tick",
          "value": 109386
        },
        {
          "id": "forceGC",
          "value": 1142
        },
        {
          "id": "stackTrace",
          "value": 83400
        },
        {
          "id": "dbg",
          "value": 199186
        }
      ]
    },
    {
      "id": "generators",
      "children": [
        {
          "id": "address",
          "value": 29476
        },
        {
          "id": "city",
          "value": 148506
        },
        {
          "id": "animal",
          "value": 143025
        },
        {
          "id": "movie",
          "value": 76508
        },
        {
          "id": "user",
          "value": 129961
        }
      ]
    },
    {
      "id": "set",
      "children": [
        {
          "id": "clone",
          "value": 181774
        },
        {
          "id": "intersect",
          "value": 46789
        },
        {
          "id": "merge",
          "value": 181479
        },
        {
          "id": "reverse",
          "value": 74735
        },
        {
          "id": "toArray",
          "value": 144174
        },
        {
          "id": "toObject",
          "value": 26815
        },
        {
          "id": "fromCSV",
          "value": 122348
        },
        {
          "id": "slice",
          "value": 136800
        },
        {
          "id": "append",
          "value": 49727
        },
        {
          "id": "prepend",
          "value": 142265
        },
        {
          "id": "shuffle",
          "value": 131972
        },
        {
          "id": "pick",
          "value": 13544
        },
        {
          "id": "plouc",
          "value": 22760
        }
      ]
    },
    {
      "id": "text",
      "children": [
        {
          "id": "trim",
          "value": 14092
        },
        {
          "id": "slugify",
          "value": 74715
        },
        {
          "id": "snakeCase",
          "value": 112738
        },
        {
          "id": "camelCase",
          "value": 43140
        },
        {
          "id": "repeat",
          "value": 193770
        },
        {
          "id": "padLeft",
          "value": 32042
        },
        {
          "id": "padRight",
          "value": 27387
        },
        {
          "id": "sanitize",
          "value": 49430
        },
        {
          "id": "ploucify",
          "value": 98050
        }
      ]
    },
    {
      "id": "misc",
      "children": [
        {
          "id": "greetings",
          "children": [
            {
              "id": "hey",
              "value": 51767
            },
            {
              "id": "HOWDY",
              "value": 97950
            },
            {
              "id": "aloha",
              "value": 31324
            },
            {
              "id": "AHOY",
              "value": 62872
            }
          ]
        },
        {
          "id": "other",
          "value": 136134
        },
        {
          "id": "path",
          "children": [
            {
              "id": "pathA",
              "value": 178541
            },
            {
              "id": "pathB",
              "children": [
                {
                  "id": "pathB1",
                  "value": 75854
                },
                {
                  "id": "pathB2",
                  "value": 186263
                },
                {
                  "id": "pathB3",
                  "value": 38933
                },
                {
                  "id": "pathB4",
                  "value": 169774
                }
              ]
            },
            {
              "id": "pathC",
              "children": [
                {
                  "id": "pathC1",
                  "value": 24111
                },
                {
                  "id": "pathC2",
                  "value": 183850
                },
                {
                  "id": "pathC3",
                  "value": 120852
                },
                {
                  "id": "pathC4",
                  "value": 115893
                },
                {
                  "id": "pathC5",
                  "value": 138143
                },
                {
                  "id": "pathC6",
                  "value": 61888
                },
                {
                  "id": "pathC7",
                  "value": 122344
                },
                {
                  "id": "pathC8",
                  "value": 197565
                },
                {
                  "id": "pathC9",
                  "value": 97837
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

I want you through glance through our datasets and see how should we display this, would you have segments on the layers, keep in mind they will have a hidden or minimal state for the most part its only on hover we see a lot of its data.

+