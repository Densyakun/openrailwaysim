import FakeRest from 'fakerest';
import { DataProvider } from 'ra-core';

export type Id = number | string;

export type Data = {
  [key: string]: { id: Id }[]
};

export default function dataProvider<T extends Data>(data: T, mutate: (newData: T) => void): DataProvider {
  const restServer = new FakeRest.Server();
  restServer.init(data);

  if (typeof window !== 'undefined') {
    // give way to update data in the console
    (window as any).restServer = restServer;
  }

  function getResponse(type: string, resource: string, params: any) {
    switch (type) {
      case 'getList': {
        const { page, perPage } = params.pagination;
        const { field, order } = params.sort;
        const query = {
          sort: [field, order],
          range: [(page - 1) * perPage, page * perPage - 1],
          filter: params.filter,
        };
        return {
          data: restServer.getAll(resource, query),
          total: restServer.getCount(resource, {
            filter: params.filter,
          }),
        };
      }
      case 'getOne':
        return {
          data: restServer.getOne(resource, params.id, { ...params }),
        };
      case 'getMany':
        return {
          data: restServer.getAll(resource, {
            filter: { id: params.ids },
          }),
        };
      case 'getManyReference': {
        const { page, perPage } = params.pagination;
        const { field, order } = params.sort;
        const query = {
          sort: [field, order],
          range: [(page - 1) * perPage, page * perPage - 1],
          filter: { ...params.filter, [params.target]: params.id },
        };
        return {
          data: restServer.getAll(resource, query),
          total: restServer.getCount(resource, {
            filter: query.filter,
          }),
        };
      }
      case 'update':
        return {
          data: restServer.updateOne(resource, params.id, {
            ...params.data,
          }),
        };
      case 'updateMany':
        params.ids.forEach((id: Id) =>
          restServer.updateOne(resource, id, {
            ...params.data,
          })
        );
        return { data: params.ids };
      case 'create':
        return {
          data: restServer.addOne(resource, { ...params.data }),
        };
      case 'delete':
        return { data: restServer.removeOne(resource, params.id) };
      case 'deleteMany':
        params.ids.forEach((id: Id) => restServer.removeOne(resource, id));
        return { data: params.ids };
      default:
        return false;
    }
  }

  /**
   * @param {String} type One of the data Provider methods, e.g. 'getList'
   * @param {String} resource Name of the resource to fetch, e.g. 'posts'
   * @param {Object} params The data request params, depending on the type
   * @returns {Promise} The response
   */
  const handle = (type: string, resource: string, params: any): Promise<any> => {
    const collection = restServer.getCollection(resource);
    if (!collection && type !== 'create') {
      const error = new Error(
        `Undefined collection "${resource}"`
      );
      return Promise.reject(error);
    }
    let response;
    try {
      response = getResponse(type, resource, params);
    } catch (error) {
      console.error(error);
      return Promise.reject(error);
    }

    // Callback
    if (
      type === 'update'
      || type === 'updateMany'
      || type === 'create'
      || type === 'delete'
      || type === 'deleteMany'
    )
      mutate(getData());

    return Promise.resolve(response);
  };

  return {
    getList: (resource, params) => handle('getList', resource, params),
    getOne: (resource, params) => handle('getOne', resource, params),
    getMany: (resource, params) => handle('getMany', resource, params),
    getManyReference: (resource, params) =>
      handle('getManyReference', resource, params),
    update: (resource, params) => handle('update', resource, params),
    updateMany: (resource, params) =>
      handle('updateMany', resource, params),
    create: (resource, params) => handle('create', resource, params),
    delete: (resource, params) => handle('delete', resource, params),
    deleteMany: (resource, params) =>
      handle('deleteMany', resource, params),
  };

  function getData() {
    const data: Data = {};

    Object.values(restServer.collections as {
      [key: string]: { name: string, items: { id: Id }[] }
    }).forEach(collection =>
      data[collection.name] = collection.items
    );

    return data as T;
  }
}
