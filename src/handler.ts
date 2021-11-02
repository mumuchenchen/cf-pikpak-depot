import { Client } from "@notionhq/client"
import md5 from 'md5'

const notion = new Client({ auth: NOTION_ACCESS_TOKEN })
const responseJson = (json:object, request: Request) => {
  return new Response(JSON.stringify(json), {
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Origin":  request.headers.get('Origin') || '',
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get('Access-Control-Allow-Headers') || "Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token, Notion-Version"
    },
  })
}
const responseError = (error:string, request: Request) => {
  return new Response(JSON.stringify({error: error || '出错了'}), {
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Origin":  request.headers.get('Origin') || '',
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get('Access-Control-Allow-Headers') || "Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token, Notion-Version"
    },
    status: 400
  })
}
const getPage = async (request: Request) => {
  try {
    // 5a3a0272-0b9a-4640-8e6a-e2cfbba27e9e
    const url = new URL(request.url)
    const page_id = url.searchParams.get('page_id')
    if(page_id) {
      const page = await notion.pages.retrieve({
        page_id: page_id
      })
      if(page.archived) {
        return responseError('分享已超时', request)
      }
      const pageResult:any = {
        id: page.id
      }
      for(let key in  page.properties) {
        pageResult[key] = ''
        const item = page.properties[key]
        if(item.type === 'created_time') {
          pageResult[key] = item.created_time
        }
        if(item.type === 'title') {
          item.title.forEach(itemTitle => {
            pageResult[key] = pageResult[key] + itemTitle.plain_text
          })
        }
        if(item.type === 'rich_text') {
          item.rich_text.forEach(itemTitle => {
            pageResult[key] = pageResult[key] + itemTitle.plain_text
          })
        }
      }
      const nowTime = new Date().getTime()
      if(nowTime > Number(pageResult.delete_time)) {
        try {
          await fetch('https://api.notion.com/v1/pages/' + page_id, {
            method: 'PATCH',
            headers: {
              Authorization: 'Bearer ' + NOTION_ACCESS_TOKEN,
              'Content-Type': 'application/json',
              'Notion-Version': '2021-08-16'
            },
            body: JSON.stringify({
              archived: true
            })
          })
          
        } catch (error:any) {
          console.log(error.message)
        }
        return responseError('分享已超时', request)
      }
      if(pageResult.password) {
        let password = url.searchParams.get('password')
        if(!password || pageResult.password != md5(password)) {
          return responseJson({needPassword: true}, request) 
        }
      }
      delete pageResult.password
      return responseJson(pageResult, request)
    }
    return responseError('参数错误', request)
  } catch (error:any) {
    
    return responseError('分享不存在或已超时', request)
  }
}
const postPage = async (request: Request) => {
  const postData:any = await request.json()
  if(!postData.info || !postData.uid || !postData.Name || !postData.delete_time) {
    return responseError('参数错误', request)
  }
  postData.info = Object.assign(postData.info, postData.info2 || {}, postData.info3 || {})
  try {
    const properties = {
      Name: {
        title: [
          {
            text: {
              content: postData.Name
            }
          }
        ]
      },
      info: {
        rich_text: [
          {
            text: {
              content: ''
            }
          }
        ]
      },
      info2: {
        rich_text: [
          {
            text: {
              content: ''
            }
          }
        ]
      },
      info3: {
        rich_text: [
          {
            text: {
              content: ''
            }
          }
        ]
      },
      delete_time: {
        rich_text: [
          {
            text: {
              content: postData.delete_time
            }
          }
        ]
      },
      password: {
        rich_text: [
          {
            text: {
              content: postData.password ? md5(postData.password) : ''
            }
          }
        ]
      },
      uid: {
        rich_text: [
          {
            text: {
              content: postData.uid || ''
            }
          }
        ]
      }
    }
    if(postData.info && postData.info) {
      properties.info = {
        rich_text: [
        ]
      }
      let info = JSON.stringify(postData.info)
      for(let i = 0,l = info.length; i < l / 2000; i++) {
        const temp = info.slice(2000 * i, 2000 * (i+1))
        properties.info.rich_text.push({
          text: {
            content: temp
          }
        })
      }
    }
    const page = await notion.pages.create({
      parent: {
        database_id: NOTION_DATABASE_ID
      },
      properties
    })
    return responseJson({id:page.id}, request)
  } catch (error:any) {
    return responseError(error.message || '', request)
  }
}
export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return responseJson({}, request)
  } else if(request.method === 'GET') {
    return getPage(request)
  } else if(request.method === 'POST'){
    return postPage(request)
  }
  return responseError('禁止方法', request)
}
