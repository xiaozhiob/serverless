export default {
  async setBucketName() {
    if (this.bucketName) {
      return this.bucketName
    }

    return this.provider
      .getServerlessDeploymentBucketName()
      .then((bucketName) => {
        this.bucketName = bucketName
      })
  },
}
